/**
 * A deadline that measures INACTIVITY rather than total elapsed time.
 *
 * Written for the chat stream in src/hooks/use-chat.ts, where the previous timer was a
 * single wall-clock deadline for the whole turn: armed before the history query and
 * cleared only after the assistant message was saved, so it spanned the history fetch,
 * the user-message insert, the LLM request AND the entire stream read. Any answer that
 * took longer than the window end to end was aborted mid-stream and discarded, however
 * healthily it was still producing tokens - the user saw a truncated reply and
 * "Response took too long", and nothing was persisted.
 *
 * Resetting on each unit of progress keeps the protection that actually matters - a
 * request that stalls with no data for `idleMs` is still cut off, and time-to-first-byte
 * is still bounded, because the first chunk is the first reset - while letting a long
 * but healthy answer finish.
 *
 * `onIdle` fires at most once per deadline: after it fires the timer stays disarmed
 * until `reset()` is called again, so a late-arriving chunk cannot abort a second time.
 */
export function createInactivityDeadline(
  onIdle: () => void,
  idleMs: number,
): { reset: () => void; clear: () => void; armed: () => boolean } {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const clear = () => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  };

  const reset = () => {
    clear();
    timer = setTimeout(() => {
      timer = undefined;
      onIdle();
    }, idleMs);
  };

  reset();
  return { reset, clear, armed: () => timer !== undefined };
}
