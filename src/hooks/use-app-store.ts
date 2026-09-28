import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { getState, hydrateFromStorage, subscribe } from "@/lib/data/store";
import {
  buildAttentionQueue,
  buildDashboardStats,
  buildIncomingFeed,
  buildMissedActivity,
  rankHotProspects,
} from "@/lib/intelligence/attention";
import { formStats, prospectIndex, tasksFor, type TaskView } from "@/lib/services/queries";
import type { AppState } from "@/lib/domain/types";

let hydrationStarted = false;

/**
 * Client-only hydration guard. The demo state is generated relative to `now`,
 * so it is assembled on the client (and re-anchored from localStorage) rather
 * than server-rendered — this hook keeps SSR output stable in the meantime.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (!hydrationStarted) {
      hydrationStarted = true;
      hydrateFromStorage();
    }
    setHydrated(true);
  }, []);
  return hydrated;
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getState, getState);
}

export function useBusinessId(): string {
  const state = useAppState();
  return state.session.businessId;
}

/** The single hook most screens use: business-scoped state + derived intelligence. */
export function useBusiness() {
  const state = useAppState();
  const businessId = state.session.businessId;
  const now = Date.now();

  const views = useMemo(
    () => ({
      business: state.businesses.find((b) => b.id === businessId),
      index: prospectIndex(state, businessId),
      attention: buildAttentionQueue(state, businessId, { now }),
      hot: rankHotProspects(state, businessId, 15),
      stats: buildDashboardStats(state, businessId, now),
      feed: buildIncomingFeed(state, businessId, now),
      missed: buildMissedActivity(state, businessId, now),
      currentUser: state.users.find((u) => u.id === state.session.userId),
      membership: state.memberships.find(
        (m) => m.businessId === businessId && m.userId === state.session.userId,
      ),
      aiPaused: state.aiPausedBusinessIds.includes(businessId),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, businessId],
  );

  return { state, businessId, ...views };
}

export function useTasks(view: TaskView) {
  const state = useAppState();
  const businessId = state.session.businessId;
  return useMemo(
    () => tasksFor(state, businessId, view, state.session.userId),
    [state, businessId, view],
  );
}

export function useForms() {
  const state = useAppState();
  const businessId = state.session.businessId;
  return useMemo(() => formStats(state, businessId), [state, businessId]);
}
