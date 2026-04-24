export interface SongRecommendation {
  id: string;
  spotify_url: string;
  title: string;
  artist: string;
  album: string;
  danceability: number;
  energy: number;
  valence: number;
  tempo: number;
  lyrics_preview: string;
  lyrics_full: string;
  tfidf_score: number;
  svd_score?: number;
  /** SVD/RAG: weighted TF-IDF term (max SCORE_BLEND_W_TF_IDF) before sentiment tweaks */
  score_blend_tfidf?: number;
  /** SVD/RAG: weighted music/audio term (max SCORE_BLEND_W_MUSIC) */
  score_blend_music?: number;
  /** SVD/RAG: weighted latent-SVD term (max SCORE_BLEND_W_SVD) */
  score_blend_svd?: number;
}