/**
 * Keeps track of "I have an active number rental in progress" across page
 * reloads -- most commonly iOS Safari discarding a backgrounded tab (e.g.
 * the customer switches to Messages to read the code, or their screen
 * locks) and reloading it from scratch when they come back, which wipes
 * the numbers page's in-memory React state and makes the number/code
 * dropdown look like it "cleared" even though the rental itself is still
 * fine server-side -- the customer then has to dig through History to find
 * their code instead of just seeing it back where they left it.
 *
 * Each numbers page calls save() the moment it starts a purchase and
 * clear() once that rental is fully done with (closed automatically 3
 * minutes after a code arrives, or dismissed after a hard error). In
 * between, load() on mount lets the page ask the server for that rental's
 * current status and rebuild the dropdown instead of just showing a blank
 * list.
 */
export function saveActiveRental(key: string, rentalId: string) {
  try {
    localStorage.setItem(key, rentalId);
  } catch {
    // localStorage unavailable (private mode, etc) -- worst case is the
    // same "check History" behavior this is meant to fix, nothing worse.
  }
}

export function loadActiveRental(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function clearActiveRental(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
