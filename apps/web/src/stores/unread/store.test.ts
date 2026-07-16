import { describe, expect, it } from "vitest"
import { channelUnreadStore } from "./store"

// The store is a singleton; each test uses a unique channelID to avoid shared state.
describe("channelUnreadStore.markUnread", () => {
	it("sets the count and watermark directly", () => {
		const ch = "ch-markunread-1"
		channelUnreadStore.markUnread(ch, "2026-06-10 10:00:00.000000", 3)
		expect(channelUnreadStore.getState(ch).count).toBe(3)
		expect(channelUnreadStore.getState(ch).lastSeen).toBe("2026-06-10 10:00:00.000000")
	})

	it("rolls the watermark BACKWARD where markRead would not", () => {
		const ch = "ch-markunread-2"
		// Caught up to a late watermark first (forward markRead).
		channelUnreadStore.markRead(ch, "2026-06-10 12:00:00.000000", true)
		expect(channelUnreadStore.getState(ch).count).toBe(0)

		// markRead with an earlier time is a no-op (forward-only) — proves the bug.
		channelUnreadStore.markRead(ch, "2026-06-10 11:00:00.000000", false)
		expect(channelUnreadStore.getState(ch).lastSeen).toBe("2026-06-10 12:00:00.000000")

		// markUnread DOES move it backward and set the count.
		channelUnreadStore.markUnread(ch, "2026-06-10 11:00:00.000000", 2)
		expect(channelUnreadStore.getState(ch).lastSeen).toBe("2026-06-10 11:00:00.000000")
		expect(channelUnreadStore.getState(ch).count).toBe(2)
	})

	it("rolls the server watermark BASELINE back with it", () => {
		const ch = "ch-markunread-baseline"
		// Channel load recorded the server's last_visit (high — user was caught up).
		channelUnreadStore.setServerWatermark(ch, "2026-06-10 12:00:00.000000")

		channelUnreadStore.markUnread(ch, "2026-06-10 11:00:00.000000", 2)

		// The read tracker seeds its don't-re-post guard from this baseline: if it
		// stayed at 12:00, re-reading up to 11:30 would post nothing and the
		// channel would stay unread on the server (badge back on refresh).
		expect(channelUnreadStore.getServerWatermark(ch)).toBe("2026-06-10 11:00:00.000000")
	})

	it("notifies that channel's subscribers", () => {
		const ch = "ch-markunread-3"
		let calls = 0
		const unsub = channelUnreadStore.subscribe(ch, () => calls++)
		channelUnreadStore.markUnread(ch, "2026-06-10 10:00:00.000000", 1)
		expect(calls).toBe(1)
		unsub()
	})
})
