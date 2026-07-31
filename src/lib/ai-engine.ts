/**
 * AI Engine - Smart IPTV Platform
 * ================================
 * Two core AI components:
 * 1. Recommendation Engine: TF-IDF + Cosine Similarity (Content-Based)
 * 2. Intelligent Server Selector: Multi-factor scoring
 */

// ============================================================
// 1. RECOMMENDATION ENGINE (TF-IDF + Cosine Similarity)
// ============================================================

interface WatchRecord {
  id: number;
  userId: number;
  channelId: number;
  watchedAt: string;
  watchDuration: number;
  channel: {
    id: number;
    title: string;
    category: string;
    tags: string;
    thumbnailUrl: string;
    streamUrl: string;
  };
}

interface Channel {
  id: number;
  title: string;
  category: string;
  tags: string;
  thumbnailUrl: string;
  streamUrl: string;
}

/**
 * Tokenize Arabic and English text into terms.
 * Handles Arabic diacritics removal and English lowercase normalization.
 */
function tokenize(text: string): string[] {
  // Remove Arabic diacritics (tashkeel)
  const cleaned = text
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/g, '')
    .toLowerCase();
  // Split on non-alphanumeric (handles Arabic, English, spaces, punctuation)
  return cleaned
    .split(/[^\u0600-\u06FFa-zA-Z0-9]+/)
    .filter(t => t.length > 1);
}

/**
 * Build a feature vector for a channel combining title, category, and tags.
 */
function buildChannelText(channel: { title: string; category: string; tags: string }): string {
  return `${channel.title} ${channel.category} ${channel.tags}`;
}

/**
 * Compute TF-IDF vectors for a set of documents.
 * Returns: { vectors: Map<docId, Map<term, number>>, idf: Map<term, number> }
 *
 * TF(t,d) = count(t in d) / total_terms_in_d
 * IDF(t) = log(N / (1 + df(t)))  where df = number of docs containing term t
 */
function computeTFIDF(documents: Map<number, string>) {
  const N = documents.size;
  const docTerms = new Map<number, Map<string, number>>();
  const docLengths = new Map<number, number>();
  const df = new Map<string, number>(); // document frequency
  const allTerms = new Set<string>();

  // Step 1: Compute TF for each document and count DF
  for (const [docId, text] of documents) {
    const terms = tokenize(text);
    const termFreq = new Map<string, number>();
    let totalTerms = 0;

    for (const term of terms) {
      termFreq.set(term, (termFreq.get(term) || 0) + 1);
      totalTerms++;
      allTerms.add(term);
    }

    docTerms.set(docId, termFreq);
    docLengths.set(docId, totalTerms);

    // Count unique terms per document for DF
    const uniqueTerms = new Set(terms);
    for (const term of uniqueTerms) {
      df.set(term, (df.get(term) || 0) + 1);
    }
  }

  // Step 2: Compute IDF
  const idf = new Map<string, number>();
  for (const term of allTerms) {
    const docFreq = df.get(term) || 0;
    idf.set(term, Math.log((N + 1) / (1 + docFreq)) + 1); // smoothed IDF
  }

  // Step 3: Compute TF-IDF vectors
  const vectors = new Map<number, Map<string, number>>();
  for (const [docId, termFreq] of docTerms) {
    const len = docLengths.get(docId) || 1;
    const tfidfVec = new Map<string, number>();

    for (const [term, count] of termFreq) {
      const tf = count / len;
      const idfVal = idf.get(term) || 0;
      tfidfVec.set(term, tf * idfVal);
    }

    vectors.set(docId, tfidfVec);
  }

  return { vectors, idf };
}

/**
 * Compute Cosine Similarity between two sparse vectors.
 * cos(A, B) = (A . B) / (||A|| * ||B||)
 */
function cosineSimilarity(vecA: Map<string, number>, vecB: Map<string, number>): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const [term, val] of vecA) {
    normA += val * val;
    if (vecB.has(term)) {
      dotProduct += val * vecB.get(term)!;
    }
  }

  for (const [, val] of vecB) {
    normB += val * val;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

/**
 * Build a user preference vector from their watch history.
 * Channels watched longer get higher weight.
 */
function buildUserVector(
  history: WatchRecord[],
  allChannels: Channel[],
  idf: Map<string, number>
): Map<string, number> {
  const userVec = new Map<string, number>();
  let totalWeight = 0;

  for (const record of history) {
    const channel = record.channel;
    if (!channel) continue;

    // Weight by watch duration (more time watched = stronger preference)
    const weight = 1 + (record.watchDuration / 60); // +1 to avoid zero weight
    totalWeight += weight;

    const text = buildChannelText(channel);
    const terms = tokenize(text);
    const termFreq = new Map<string, number>();
    let total = 0;

    for (const term of terms) {
      termFreq.set(term, (termFreq.get(term) || 0) + 1);
      total++;
    }

    for (const [term, count] of termFreq) {
      const tf = count / (total || 1);
      const tfidf = tf * (idf.get(term) || 0);
      userVec.set(term, (userVec.get(term) || 0) + tfidf * weight);
    }
  }

  // Normalize
  if (totalWeight > 0) {
    for (const [term, val] of userVec) {
      userVec.set(term, val / totalWeight);
    }
  }

  return userVec;
}

/**
 * Main Recommendation Function
 * =============================
 * Implements Content-Based Filtering using TF-IDF + Cosine Similarity.
 * Enhanced with user rating signals.
 *
 * Algorithm:
 * 1. Build TF-IDF vectors for all channels
 * 2. Build user preference vector from watch history (weighted by duration)
 * 3. Boost channels with high user ratings
 * 4. Compute cosine similarity between user vector and each unwatched channel
 * 5. Return top-N most similar channels
 *
 * @param history - User's watch history records
 * @param allChannels - All available channels
 * @param ratings - User's ratings (optional) for enhanced recommendations
 * @param topN - Number of recommendations to return (default: 10)
 * @returns Array of recommended channel IDs, sorted by relevance score
 */
export function getRecommendations(
  history: WatchRecord[],
  allChannels: Channel[],
  ratings?: { channelId: number; score: number }[],
  topN: number = 10
): number[] {
  if (history.length === 0 || allChannels.length === 0) {
    // No history: return popular channels (most watched or random selection)
    return allChannels.slice(0, topN).map(ch => ch.id);
  }

  // Step 1: Build TF-IDF for all channels
  const channelDocs = new Map<number, string>();
  for (const ch of allChannels) {
    channelDocs.set(ch.id, buildChannelText(ch));
  }
  const { vectors: channelVectors, idf } = computeTFIDF(channelDocs);

  // Step 2: Build user preference vector
  const userVec = buildUserVector(history, allChannels, idf);

  if (userVec.size === 0) {
    return allChannels.slice(0, topN).map(ch => ch.id);
  }

  // Step 3: Get watched channel IDs to exclude
  const watchedIds = new Set(history.map(h => h.channelId));

  // Step 4: Compute similarity for each unwatched channel
  const scores: { channelId: number; score: number }[] = [];
  const ratingMap = new Map(ratings?.map(r => [r.channelId, r.score]) || []);

  for (const [chId, chVec] of channelVectors) {
    if (watchedIds.has(chId)) continue;
    let similarity = cosineSimilarity(userVec, chVec);

    // Rating boost: if user rated similar-category channels highly,
    // boost this channel's score
    const channelData = allChannels.find(ch => ch.id === chId);
    if (channelData) {
      const sameCatRatings = allChannels
        .filter(ch => ch.category === channelData.category)
        .map(ch => ratingMap.get(ch.id))
        .filter((r): r is number => r !== undefined);
      if (sameCatRatings.length > 0) {
        const avgRating = sameCatRatings.reduce((a, b) => a + b, 0) / sameCatRatings.length;
        const boost = (avgRating - 3) / 10; // Normalize: rating 3 = no boost, 5 = +0.2
        similarity += boost;
      }
    }

    scores.push({ channelId: chId, score: similarity });
  }

  // Step 5: Sort by score descending and return top-N
  scores.sort((a, b) => b.score - a.score);

  // If not enough unwatched channels, include some watched ones with lower priority
  if (scores.length < topN) {
    for (const chId of watchedIds) {
      const chVec = channelVectors.get(chId);
      if (chVec) {
        const similarity = cosineSimilarity(userVec, chVec) * 0.5; // Reduce score for watched
        scores.push({ channelId: chId, score: similarity });
      }
    }
    scores.sort((a, b) => b.score - a.score);
  }

  return scores.slice(0, topN).map(s => s.channelId);
}

// ============================================================
// 2. INTELLIGENT SERVER SELECTOR
// ============================================================

interface Server {
  id: number;
  serverName: string;
  ipAddress: string;
  region: string;
  currentLoad: number;
  status: string;
}

/**
 * Estimate geographic distance score between user IP region and server region.
 * Uses simple string matching and predefined region proximity.
 * In production, this would use a GeoIP database.
 */
function getProximityScore(userIp: string, serverRegion: string): number {
  // Simple heuristic: if server region contains common geo keywords
  const regions: Record<string, string[]> = {
    'middle_east': ['middle east', 'syria', 'lebanon', 'jordan', 'iraq', 'saudi', 'uae', 'gcc', 'gulf'],
    'europe': ['europe', 'germany', 'france', 'london', 'uk', 'netherlands', 'amsterdam'],
    'us': ['us', 'usa', 'america', 'new york', 'chicago', 'los angeles'],
    'asia': ['asia', 'singapore', 'hong kong', 'japan', 'tokyo', 'india'],
  };

  const serverLower = serverRegion.toLowerCase();

  for (const [, keywords] of Object.entries(regions)) {
    if (keywords.some(kw => serverLower.includes(kw))) {
      return 0.8 + Math.random() * 0.2; // High proximity
    }
  }

  return 0.3 + Math.random() * 0.3; // Lower proximity for unmatched regions
}

/**
 * Simulate response time measurement (ping).
 * In production, this would be an actual ICMP/TCP ping measurement.
 */
function estimateResponseTime(server: Server): number {
  // Simulate: base latency + load-based penalty
  const baseLatency = 20 + Math.random() * 30; // 20-50ms base
  const loadPenalty = server.currentLoad * 2; // Higher load = more latency
  return baseLatency + loadPenalty;
}

/**
 * Intelligent Server Selection Algorithm
 * =====================================
 * Multi-factor scoring system that selects the optimal streaming server.
 *
 * Scoring Formula:
 *   Score = w1 * (1 - normalizedLoad) + w2 * proximityScore + w3 * (1 - normalizedLatency)
 *
 * Where:
 *   - normalizedLoad: current server load (0-100%) normalized to 0-1
 *   - proximityScore: geographic proximity (0-1, higher = closer)
 *   - normalizedLatency: estimated response time normalized to 0-1
 *   - w1 = 0.4 (load weight - highest priority)
 *   - w2 = 0.35 (proximity weight)
 *   - w3 = 0.25 (latency weight)
 *
 * @param servers - List of active servers
 * @param userIp - User's IP address (for geo estimation)
 * @returns Best server or null if none available
 */
export function selectBestServer(servers: Server[], userIp: string): Server | null {
  if (servers.length === 0) return null;

  const W_LOAD = 0.4;
  const W_PROXIMITY = 0.35;
  const W_LATENCY = 0.25;

  let bestServer: Server | null = null;
  let bestScore = -1;

  // Estimate latencies for all servers first
  const latencies = new Map<number, number>();
  for (const server of servers) {
    latencies.set(server.id, estimateResponseTime(server));
  }

  // Find max latency for normalization
  const maxLatency = Math.max(...Array.from(latencies.values()));

  for (const server of servers) {
    // Factor 1: Load score (lower load = better)
    const loadScore = 1 - server.currentLoad / 100;

    // Factor 2: Proximity score
    const proximityScore = getProximityScore(userIp, server.region);

    // Factor 3: Latency score (lower latency = better)
    const latency = latencies.get(server.id) || 50;
    const latencyScore = 1 - latency / (maxLatency || 1);

    // Weighted combination
    const totalScore = W_LOAD * loadScore + W_PROXIMITY * proximityScore + W_LATENCY * latencyScore;

    console.log(
      `[Server Selector] ${server.serverName}: load=${server.currentLoad}% ` +
      `proximity=${proximityScore.toFixed(2)} latency=${latency.toFixed(0)}ms ` +
      `score=${totalScore.toFixed(3)}`
    );

    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestServer = server;
    }
  }

  return bestServer;
}