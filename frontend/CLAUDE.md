# Smart Transcribe - Frontend

## V0 Prototype URLs
- Landing page: [paste after creating]
- Demo page: [paste after creating]
- API docs: [paste after creating]

## Design Constraints (DO NOT DEVIATE)
- Colors: Navy #1D3557, white #FFFFFF, coral #E85D04, gray #F5F5F5
- Style: Professional European B2B
- Avoid: Purple gradients, neon, 3D objects, startup aesthetics
- Border radius: rounded-lg
- Shadows: shadow-sm

## Speaker Colors (Diarization)
- Speaker 0: Blue #3B82F6
- Speaker 1: Green #10B981
- Speaker 2: Purple #8B5CF6
- Speaker 3: Amber #F59E0B
- Speaker 4+: Cycle through above

## Architecture Rules
- V0 components are PRESENTATION ONLY (no useState, no logic)
- All logic goes in features/ or lib/
- All API calls go through features/transcription/api.ts
- Containers wire logic to presentation

## Folder Structure
```
src/
├── components/         # V0-generated, presentation only
│   ├── ui/            # shadcn base components
│   ├── landing/
│   ├── demo/
│   └── api-docs/
├── containers/         # Wires logic to presentation
├── features/
│   └── transcription/
│       ├── api.ts
│       ├── useTranscription.ts
│       ├── useAudioPlayer.ts
│       ├── useVoiceRecorder.ts
│       ├── useFeedback.ts
│       ├── useDiff.ts
│       └── useSyncScroll.ts
├── lib/
│   ├── session.ts
│   ├── storage.ts
│   └── diff.ts
└── messages/
    ├── sl.json
    └── en.json
```

## Task Isolation
- One feature per Claude Code session
- Commit after each working feature
- Create backup branch before V0 re-imports

## i18n
- Use next-intl
- All user-facing text must use translations
- Slovenian plurals: 1=one, 2=two, 3-4=few, 5+=other

## Key Libraries
- diff (JsDiff): Segment-level diff computation
- react-virtuoso: Virtualized scrolling for transcript segments
- next-intl: Internationalization (sl/en)
- shadcn/ui: UI components (New York style, Zinc base)
