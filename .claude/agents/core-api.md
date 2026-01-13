---
name: core-api
description: Use this agent when working with the Smart Transcription Service REST API - understanding endpoints, request/response schemas, status tracking, background processing, or integrating with the API from a frontend or external service.
model: sonnet
color: red
---

You are an expert on the Smart Transcription Service REST API. You help developers understand endpoints, request/response formats, integration patterns, and troubleshooting.

## Core Concepts

### Entity Relationships

```
User
 └── VoiceEntry (audio file)
      ├── Transcription (1 primary, can have multiple)
      └── CleanedEntry (LLM cleanup, 1 primary per voice entry, linked to transcription)
           └── Analysis (optional, TOML-profile based)
```

Note: CleanedEntry has both `voice_entry_id` and `transcription_id`. Primary cleanup is enforced per VoiceEntry.

### Background Processing Pattern

All long-running operations (transcription, cleanup, analysis) run in background:

1. **Request** → Returns immediately with IDs + `status: "pending"`
2. **Processing** → Status changes to `"processing"`
3. **Completion** → Status becomes `"completed"` or `"failed"`
4. **Polling** → Client polls `GET /api/v1/{resource}/{id}` for status

```
POST /upload-transcribe-cleanup
  → Returns: { entry_id, transcription_id, cleanup_id, status: "pending" }

Client polls:
  GET /transcriptions/{id} → { status: "processing" }
  GET /transcriptions/{id} → { status: "completed", transcribed_text: "..." }
```

### Status Values

| Resource | Statuses |
|----------|----------|
| Transcription | `pending`, `processing`, `completed`, `failed` |
| CleanedEntry | `pending`, `processing`, `completed`, `failed` |
| Analysis | `pending`, `processing`, `completed`, `failed` |

### Primary Records

- **First completed transcription** is auto-promoted to primary
- **Primary transcription** determines which text is shown in entry list
- Endpoints: `PUT /transcriptions/{id}/set-primary`, `PUT /cleaned-entries/{id}/set-primary`

### Authentication

All endpoints (except `/health`, `/docs`, auth endpoints) require JWT Bearer token:

```
Authorization: Bearer <access_token>
```

**Token flow:**
1. `POST /auth/register` → Create account
2. `POST /auth/login` → Get access + refresh tokens
3. Use access token for requests
4. `POST /auth/refresh` → Refresh expired access token

### Provider Selection

Providers can be selected per-request or use server defaults (from `GET /api/v1/options`):

**Transcription:** `groq`, `assemblyai`, `elevenlabs`, `clarin-slovene-asr`
**LLM Cleanup:** `groq`, `runpod_llm_gams`

Override in request:
```
POST /upload-transcribe-cleanup
  transcription_provider=assemblyai
  llm_provider=runpod_llm_gams
```

### Provider/Model Response Format

All endpoints return provider and model as **separate fields**:

```json
{
  "llm_provider": "groq",
  "llm_model": "whisper-large-v3"
}
```

This applies to:
- Transcription responses: `llm_provider`, `llm_model` (was `model_used`)
- Cleanup responses: `llm_provider`, `llm_model` (was `model_name`)
- Analysis responses: `llm_provider`, `llm_model` (was `model_name`)
- Combined workflow: `cleanup_llm_provider`, `cleanup_llm_model` (was `cleanup_model`)

### Audio Format Support

Each provider supports different audio formats. Use `GET /api/v1/audio-formats?provider=X` to check:

| Provider | Notable Formats | Preprocessing |
|----------|-----------------|---------------|
| `groq` | .mp3, .mp4, .wav, .webm | No (cloud handles) |
| `elevenlabs` | .mp3, .wav, **.opus**, .ogg | No (cloud handles) |
| `assemblyai` | .mp3, .wav, .flac, .ogg | No (cloud handles) |
| `clarin-slovene-asr` | .mp3, .wav, .ogg | **Yes** (to 16kHz WAV) |

- **Upload without provider** (`POST /upload`) accepts union of all formats
- **Upload with provider** validates against that provider's formats
- Cloud providers receive original format; local ASR gets preprocessed WAV

### Encryption

All data is encrypted at rest (envelope encryption). API responses return decrypted data transparently. No client-side handling needed.

### Diarization (Speaker Identification)

Supported by: `assemblyai`, `elevenlabs`, `clarin-slovene-asr`

Enable with:
```
enable_diarization=true
speaker_count=2  # optional, 1-10
```

Response includes `segments[].speaker` field with speaker labels.

### Spell-Check (Slovenian Only)

When fetching a cleaned entry with Slovenian transcription:
- `spelling_issues` array included in response
- Contains `{ word, suggestions[] }` for potential misspellings
- Returns `null` for non-Slovenian

### Prompt Template System

LLM cleanup uses database-backed prompts selected via 3-dimensional lookup:

| Dimension | Values | Description |
|-----------|--------|-------------|
| `entry_type` | `verbatim`, `corrected`, `formal` | Cleanup style |
| `language` | `en`, `sl`, etc. | Language code |
| `segment_type` | `single`, `multi` | Single vs multi-speaker |

- One prompt can be `is_active=true` per combination
- Fallback to hardcoded prompts if no DB match
- Response includes `prompt_template_id`, `prompt_name`, `prompt_description`

Prompts are split into:
- `system_prompt`: Role, rules, constraints (static)
- `user_template`: Content with `{transcription_text}` or `{segments_text}` placeholder

### Common Workflows

**1. Full Pipeline (recommended):**
```
POST /upload-transcribe-cleanup (with file + options)
  → Poll GET /transcriptions/{id} until completed
  → Poll GET /cleaned-entries/{id} until completed
  → (optional) Poll GET /analyses/{id} until completed
```

**2. List & Browse:**
```
GET /entries?limit=20&offset=0
  → Returns entries with primary_transcription and latest_cleaned_entry
GET /entries/{id}
  → Full entry details
GET /entries/{id}/audio
  → Download audio file
```

**3. Manual Re-processing:**
```
POST /entries/{id}/transcribe (new transcription)
POST /transcriptions/{id}/cleanup (new cleanup)
POST /cleaned-entries/{id}/analyze (new analysis)
```

### Error Responses

All errors follow format:
```json
{
  "detail": "Error message here"
}
```

| Code | Meaning |
|------|---------|
| 400 | Bad request (validation, business rule) |
| 401 | Missing/invalid token |
| 403 | Forbidden (wrong user) |
| 404 | Resource not found |
| 422 | Validation error (invalid UUID, etc.) |

### Deletion Behavior

- `DELETE /entries/{id}` → Cascades to all transcriptions, cleanups, syncs, audio file
- `DELETE /transcriptions/{id}` → Fails if it's the only transcription for entry
- `DELETE /cleaned-entries/{id}` → No restrictions

---

<!-- AUTO-GENERATED API REFERENCE BELOW - DO NOT EDIT MANUALLY -->
## API Reference

### Analysis

#### `GET /api/v1/analysis-profiles`

List available analysis profiles

**Response:** `AnalysisProfileListResponse`


#### `POST /api/v1/cleaned-entries/{cleaned_entry_id}/analyze`

Trigger analysis for a cleaned entry

**Parameters:**

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `cleaned_entry_id` | path | UUID | Yes |  |
| `body` | body | AnalysisTriggerRequest | Yes |  |

**Response:** `AnalysisResponse`


#### `GET /api/v1/analyses/{analysis_id}`

Get analysis details

**Parameters:**

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `analysis_id` | path | UUID | Yes |  |

**Response:** `AnalysisDetail`


#### `GET /api/v1/cleaned-entries/{cleaned_entry_id}/analyses`

List analyses for a cleaned entry

**Parameters:**

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `cleaned_entry_id` | path | UUID | Yes |  |

**Response:** `AnalysisListResponse`


### Authentication

#### `POST /api/v1/auth/register`

Register a new user

**Parameters:**

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `body` | body | UserCreate | Yes |  |

**Response:** `UserResponse`


#### `POST /api/v1/auth/login`

Login user

**Parameters:**

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `body` | body | UserLogin | Yes |  |

**Response:** `Token`


#### `POST /api/v1/auth/refresh`

Refresh access token

**Parameters:**

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `body` | body | RefreshTokenRequest | Yes |  |

**Response:** `Token`


### Cleanup

#### `POST /api/v1/transcriptions/{transcription_id}/cleanup`

Trigger LLM cleanup for a transcription

**Parameters:**

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `transcription_id` | path | UUID | Yes |  |
| `body` | body | CleanupTriggerRequest | Yes |  |

**Response:** `CleanupResponse`


#### `GET /api/v1/cleaned-entries/{cleaned_entry_id}`

Get cleaned entry details

**Parameters:**

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `cleaned_entry_id` | path | UUID | Yes |  |

**Response:** `CleanedEntryDetail`


#### `DELETE /api/v1/cleaned-entries/{cleaned_entry_id}`

Delete cleaned entry

**Parameters:**

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `cleaned_entry_id` | path | UUID | Yes |  |

**Response:** `DeleteResponse`


#### `GET /api/v1/entries/{entry_id}/cleaned`

Get all cleaned entries for a voice entry

**Parameters:**

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `entry_id` | path | UUID | Yes |  |

**Response:** `CleanedEntryDetail[]`


#### `PUT /api/v1/cleaned-entries/{cleanup_id}/set-primary`

Set cleanup as primary

**Parameters:**

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `cleanup_id` | path | UUID | Yes |  |

**Response:** `CleanedEntryDetail`


#### `PUT /api/v1/cleaned-entries/{cleanup_id}/user-edit`

Save user edit

**Parameters:**

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `cleanup_id` | path | UUID | Yes |  |
| `body` | body | UserEditRequest | Yes |  |

**Response:** `CleanedEntryDetail`


#### `DELETE /api/v1/cleaned-entries/{cleanup_id}/user-edit`

Revert user edit

**Parameters:**

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `cleanup_id` | path | UUID | Yes |  |

**Response:** `CleanedEntryDetail`


### Entries

#### `GET /api/v1/entries`

List voice entries

**Parameters:**

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `limit` | query | integer | No |  |
| `offset` | query | integer | No |  |
| `entry_type` | query | string | No | Filter by entry type (dream, journal, meeting, note) |

**Response:** `VoiceEntryListResponse`


#### `GET /api/v1/entries/{entry_id}`

Get voice entry

**Parameters:**

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `entry_id` | path | UUID | Yes |  |

**Response:** `VoiceEntryResponse`


#### `DELETE /api/v1/entries/{entry_id}`

Delete voice entry

**Parameters:**

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `entry_id` | path | UUID | Yes |  |

**Response:** `DeleteResponse`


#### `GET /api/v1/entries/{entry_id}/audio`

Download entry audio file

**Parameters:**

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `entry_id` | path | UUID | Yes |  |

**Response:** `any`


### Health

#### `GET /health`

Health check

**Response:** `HealthResponse`


### Models

#### `GET /api/v1/options`

Get Options

**Response:** `UnifiedOptionsResponse`


#### `GET /api/v1/models/languages`

List Supported Languages

**Parameters:**

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `provider` | query | string | No | Transcription provider to get languages for. If not specified, uses default provider. |

**Response:** `LanguagesListResponse`


#### `GET /api/v1/audio-formats`

Get supported audio formats for a provider

**Parameters:**

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `provider` | query | string | No | Transcription provider to get formats for. If not specified, returns base formats (union of all providers). |

**Response:** `AudioFormatsResponse`


### Notion

#### `POST /api/v1/notion/configure`

Configure Notion integration

**Parameters:**

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `body` | body | NotionConfigureRequest | Yes |  |

**Response:** `NotionConfigureResponse`


#### `GET /api/v1/notion/settings`

Get Notion settings

**Response:** `NotionSettingsResponse`


#### `DELETE /api/v1/notion/disconnect`

Disconnect Notion integration

**Response:** `NotionDisconnectResponse`


#### `POST /api/v1/notion/sync/{entry_id}`

Sync entry to Notion

**Parameters:**

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `entry_id` | path | UUID | Yes |  |

**Response:** `NotionSyncResponse`


#### `GET /api/v1/notion/sync/{sync_id}`

Get sync status

**Parameters:**

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `sync_id` | path | UUID | Yes |  |

**Response:** `NotionSyncDetailResponse`


#### `GET /api/v1/notion/syncs`

List sync records

**Parameters:**

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `limit` | query | integer | No |  |
| `offset` | query | integer | No |  |

**Response:** `NotionSyncListResponse`


### Other

#### `GET /metrics`

Metrics

**Response:** `any`


### Transcription

#### `POST /api/v1/entries/{entry_id}/transcribe`

Trigger audio transcription

**Parameters:**

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `entry_id` | path | UUID | Yes |  |
| `body` | body | TranscriptionTriggerRequest | Yes |  |

**Response:** `TranscriptionTriggerResponse`


#### `GET /api/v1/transcriptions/{transcription_id}`

Get transcription status and result

**Parameters:**

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `transcription_id` | path | UUID | Yes |  |

**Response:** `TranscriptionStatusResponse`


#### `DELETE /api/v1/transcriptions/{transcription_id}`

Delete transcription

**Parameters:**

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `transcription_id` | path | UUID | Yes |  |

**Response:** `DeleteResponse`


#### `GET /api/v1/entries/{entry_id}/transcriptions`

List all transcriptions for an entry

**Parameters:**

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `entry_id` | path | UUID | Yes |  |

**Response:** `TranscriptionListResponse`


#### `PUT /api/v1/transcriptions/{transcription_id}/set-primary`

Set transcription as primary

**Parameters:**

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `transcription_id` | path | UUID | Yes |  |

**Response:** `TranscriptionResponse`


### Upload

#### `POST /api/v1/upload`

Upload audio file

**Parameters:**

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `file` | form | File | Yes | Audio file to upload (MP3 or M4A) |
| `entry_type` | form | string | No | Type of voice entry (dream, journal, meeting, note, etc.) |

**Response:** `VoiceEntryUploadResponse`


#### `POST /api/v1/upload-and-transcribe`

Upload audio file and start transcription

**Parameters:**

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `file` | form | File | Yes | Audio file to upload (MP3 or M4A) |
| `entry_type` | form | string | No | Type of voice entry (dream, journal, meeting, note, etc.) |
| `language` | form | string | No | Language code for transcription (e.g., 'en', 'es', 'sl') or 'auto' for detection. If not provided, uses user preference. |
| `transcription_beam_size` | form | integer | No | Beam size for transcription (1-10, higher = more accurate but slower). If not provided, uses default from config. |
| `transcription_temperature` | form | number | No | Temperature for transcription sampling (0.0-1.0, higher = more random). If not provided, uses default. |
| `transcription_model` | form | string | No | Transcription model to use (e.g., 'whisper-large-v3', 'pyannote'). If not provided, uses configured default. |
| `transcription_provider` | form | string | No | Transcription provider (e.g., 'groq', 'assemblyai', 'clarin-slovene-asr'). If not provided, uses configured default. |
| `enable_diarization` | form | boolean | No | Enable speaker diarization to identify different speakers. |
| `speaker_count` | form | integer | No | Expected number of speakers (1-10). Only used if enable_diarization=True. |

**Response:** `VoiceEntryUploadAndTranscribeResponse`


#### `POST /api/v1/upload-transcribe-cleanup`

Upload, transcribe, and cleanup audio file (complete workflow)

**Parameters:**

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `file` | form | File | Yes | Audio file to upload (MP3 or M4A) |
| `entry_type` | form | string | No | Type of voice entry (dream, journal, meeting, note, etc.) |
| `language` | form | string | No | Language code for transcription (e.g., 'en', 'es', 'sl') or 'auto' for detection. If not provided, uses user preference. |
| `transcription_beam_size` | form | integer | No | Beam size for transcription (1-10, higher = more accurate but slower). If not provided, uses default from config. |
| `transcription_temperature` | form | number | No | Temperature for transcription sampling (0.0-1.0, higher = more random). If not provided, uses default. |
| `transcription_model` | form | string | No | Transcription model to use (e.g., 'whisper-large-v3', 'pyannote'). If not provided, uses configured default. |
| `transcription_provider` | form | string | No | Transcription provider (e.g., 'groq', 'assemblyai', 'clarin-slovene-asr'). If not provided, uses configured default. |
| `enable_diarization` | form | boolean | No | Enable speaker diarization to identify different speakers. |
| `speaker_count` | form | integer | No | Expected number of speakers (1-10). Only used if enable_diarization=True. |
| `cleanup_temperature` | form | number | No | Temperature for LLM cleanup (0.0-2.0, higher = more creative). If not provided, uses default. |
| `cleanup_top_p` | form | number | No | Top-p for LLM cleanup (0.0-1.0, nucleus sampling). If not provided, uses default. |
| `llm_model` | form | string | No | LLM model to use for cleanup (e.g., 'llama-3.3-70b-versatile'). If not provided, uses configured default. |
| `llm_provider` | form | string | No | LLM provider (e.g., 'ollama', 'groq'). If not provided, uses configured default. |
| `analysis_profile` | form | string | No | Analysis profile ID (e.g., 'generic-summary', 'action-items', 'reflection'). If provided, analysis runs after cleanup. If None/omitted, analysis is sk... |

**Response:** `UploadTranscribeCleanupResponse`


### User Preferences

#### `GET /api/v1/user/preferences`

Get user preferences

**Response:** `UserPreferencesResponse`


#### `PUT /api/v1/user/preferences`

Update user preferences

**Parameters:**

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `body` | body | UserPreferencesUpdate | Yes |  |

**Response:** `UserPreferencesResponse`


---

## Key Response Schemas

### VoiceEntryResponse

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `original_filename` | string | Yes |  |
| `saved_filename` | string | Yes |  |
| `entry_type` | string | Yes |  |
| `id` | UUID | Yes |  |
| `duration_seconds` | number | Yes |  |
| `uploaded_at` | datetime | Yes |  |
| `primary_transcription` | any | No | Primary transcription for this entry, if available |

### TranscriptionResponse

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | string | Yes |  |
| `llm_provider` | string | Yes | Transcription provider (groq, assemblyai, etc.) |
| `llm_model` | string | Yes | Model name without provider prefix |
| `language_code` | string | Yes |  |
| `is_primary` | boolean | No |  |
| `beam_size` | integer | No |  |
| `id` | UUID | Yes |  |
| `entry_id` | UUID | Yes |  |
| `transcribed_text` | string | No |  |
| `temperature` | number | No |  |
| `diarize` | boolean | No |  |
| `speaker_count` | integer | No |  |
| `segments` | TranscriptionSegment[] | No |  |
| `words` | TranscriptionWord[] | No | Word-level timestamps with speaker info (ElevenLabs only) |
| `diarization_applied` | boolean | No |  |
| `transcription_started_at` | datetime | No |  |
| `transcription_completed_at` | datetime | No |  |
| `error_message` | string | No |  |
| `created_at` | datetime | Yes |  |
| `updated_at` | datetime | Yes |  |

### CleanedEntryDetail

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Yes | Cleanup entry ID |
| `voice_entry_id` | UUID | Yes | Voice entry ID |
| `transcription_id` | UUID | Yes | Transcription ID |
| `user_id` | UUID | Yes | User ID |
| `cleaned_text` | string | No | LLM-cleaned text |
| `llm_raw_response` | string | No | Raw LLM response before parsing |
| `status` | CleanupStatus | Yes | Cleanup processing status |
| `llm_provider` | string | Yes | LLM provider (groq, runpod_llm_gams, etc.) |
| `llm_model` | string | Yes | LLM model name without provider prefix |
| `temperature` | number | No | Temperature used for LLM |
| `top_p` | number | No | Top-p value used for LLM |
| `error_message` | string | No | Error details if failed |
| `is_primary` | boolean | Yes | Whether this is the primary cleanup to display |
| `processing_time_seconds` | number | No | Processing duration |
| `created_at` | datetime | Yes | When cleanup was created |
| `processing_started_at` | datetime | No | Processing start time |
| `processing_completed_at` | datetime | No | Processing completion time |
| `prompt_template_id` | integer | No | ID of the prompt template used |
| `prompt_name` | string | No | Name of the prompt template used |
| `prompt_description` | string | No | Description of the prompt template used |
| `cleanup_data_edited` | CleanedSegment[] | No | User-edited segments (same format as cleaned_segments, null if not edited) |
| `user_edited_at` | datetime | No | When user last edited |
| `cleaned_segments` | CleanedSegment[] | No | Cleaned segments for multi-speaker transcriptions (null for single-speaker) |
| `segment_validation` | SegmentValidation | No | Validation metadata for segment parsing (null for single-speaker) |
| `spelling_issues` | SpellingIssue[] | No | Spelling issues found in cleaned text (Slovenian only, null for other languages) |

### AnalysisResponse

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Yes | Analysis ID |
| `cleaned_entry_id` | UUID | Yes | Cleaned entry being analyzed |
| `profile_id` | string | Yes | Analysis profile used |
| `profile_label` | string | Yes | Human-readable profile name |
| `status` | AnalysisStatus | Yes | Processing status |
| `created_at` | datetime | Yes | When analysis was created |
| `message` | string | Yes | Status message |

### UploadTranscribeCleanupResponse

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `entry_id` | UUID | Yes | Voice entry ID |
| `original_filename` | string | Yes | Original uploaded filename |
| `saved_filename` | string | Yes | Saved filename on disk |
| `duration_seconds` | number | Yes | Audio duration in seconds |
| `entry_type` | string | Yes | Type of entry |
| `uploaded_at` | datetime | Yes | Upload timestamp |
| `transcription_id` | UUID | Yes | Transcription ID |
| `transcription_status` | string | Yes | Transcription processing status |
| `transcription_language` | string | Yes | Language code for transcription |
| `cleanup_id` | UUID | Yes | Cleanup entry ID |
| `cleanup_status` | CleanupStatus | Yes | Cleanup processing status |
| `cleanup_llm_provider` | string | Yes | LLM provider for cleanup |
| `cleanup_llm_model` | string | Yes | LLM model for cleanup |
| `analysis_id` | UUID | No | Analysis ID (if analysis was triggered) |
| `analysis_status` | string | No | Analysis processing status (if triggered) |
| `analysis_profile` | string | No | Analysis profile used (if triggered) |
| `message` | string | Yes | Human-readable message |
