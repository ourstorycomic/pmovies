export type MovieCard = {
  slug: string;
  name: string;
  origin_name?: string;
  poster_url?: string;
  thumb_url?: string;
  year?: number | string;
  quality?: string;
  lang?: string;
  episode_current?: string;
  category?: { name: string; slug: string }[];
  tmdb?: { vote_average?: number; vote_count?: number; season?: number };
};

export type EpisodeLink = {
  name: string;
  slug?: string;
  filename?: string;
  link_m3u8?: string;
};

export type MovieDetail = MovieCard & {
  content?: string;
  status?: string;
  time?: string;
  category?: { name: string; slug: string }[];
  country?: { name: string; slug: string }[];
  tmdb?: { vote_average?: number; vote_count?: number; season?: number };
  imdb?: { id?: string };
  actor?: string[];
  director?: string[];
  episodes?: { server_name: string; server_data: EpisodeLink[] }[];
};
