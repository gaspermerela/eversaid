import type { Meta, StoryObj } from "@storybook/nextjs"
import { PersistentWarning } from "./persistent-warning"

const meta: Meta<typeof PersistentWarning> = {
  title: "UI/PersistentWarning",
  component: PersistentWarning,
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <div className="min-h-[400px] bg-gray-100 p-8">
        <Story />
        <div className="mt-8 p-4 bg-white rounded-lg">
          <p>Page content goes here. The warning appears in the top-right corner.</p>
        </div>
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof PersistentWarning>

export const Default: Story = {
  args: {
    message: "Per-segment cleanup unavailable. Showing original text.",
    show: true,
    autoCollapseMs: 5000,
  },
}

export const ShortMessage: Story = {
  args: {
    message: "API Error",
    show: true,
    autoCollapseMs: 5000,
  },
}

export const LongMessage: Story = {
  args: {
    message: "The transcription service returned an incomplete response. Some features may not work correctly.",
    show: true,
    autoCollapseMs: 5000,
  },
}

export const WithDismiss: Story = {
  args: {
    message: "Per-segment cleanup unavailable. Showing original text.",
    show: true,
    autoCollapseMs: 5000,
    onDismiss: () => console.log("Dismissed!"),
  },
}

export const QuickCollapse: Story = {
  args: {
    message: "This collapses after 2 seconds",
    show: true,
    autoCollapseMs: 2000,
  },
}

export const NoAutoCollapse: Story = {
  args: {
    message: "This stays expanded (set autoCollapseMs very high)",
    show: true,
    autoCollapseMs: 999999,
  },
}
