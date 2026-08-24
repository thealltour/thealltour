import "server-only";

import { retrieveAgendas } from "@/lib/marketing/retrieval/retrieveAgendas";
import { retrieveBookings } from "@/lib/marketing/retrieval/retrieveBookings";
import { retrieveContentHistory } from "@/lib/marketing/retrieval/retrieveContentHistory";
import { retrieveCustomerInsights } from "@/lib/marketing/retrieval/retrieveCustomerInsights";
import { retrieveMemory } from "@/lib/marketing/retrieval/retrieveMemory";
import { retrievePerformance } from "@/lib/marketing/retrieval/retrievePerformance";
import { retrieveProduct } from "@/lib/marketing/retrieval/retrieveProduct";
import { retrievePublications } from "@/lib/marketing/retrieval/retrievePublications";
import { retrieveReviews } from "@/lib/marketing/retrieval/retrieveReviews";
import type { RetrievalAdapters } from "@/lib/marketing/retrieval/types";

export const defaultRetrievalAdapters: RetrievalAdapters = {
  retrieveProduct,
  retrieveCustomerInsights,
  retrieveBookings,
  retrieveReviews,
  retrieveContentHistory,
  retrievePublications,
  retrievePerformance,
  retrieveMemory,
  retrieveAgendas,
};
