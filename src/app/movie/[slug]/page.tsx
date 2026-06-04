import { Star } from "lucide-react";
import { notFound } from "next/navigation";
import { MotionShell } from "@/components/motion-shell";
import { MovieActions } from "@/components/movies/movie-actions";
import { VideoPlayer } from "@/components/player/video-player";
import { Button } from "@/components/ui/button";
import { CreateWatchPartyButton } from "@/components/watch-party/create-watch-party-button";
import { JoinWatchPartyForm } from "@/components/watch-party/join-watch-party-form";
import { fetchIntroDbSegment } from "@/lib/introdb";
import { fetchKkJson } from "@/lib/kkphim";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { stripHtml } from "@/lib/utils";
import type { EpisodeLink, MovieDetail } from "@/types/movie";

export const dynamic = "force-dynamic";

async function getMovie(slug: string): Promise<MovieDetail | null> {
  const payload = await fetchKkJson(`/phim/${encodeURIComponent(slug)}`, { cache: "no-store" }) as Record<string, unknown> | null;
  if (!payload) return null;
  const data = payload.data as Record<string, unknown> | undefined;
  const movie = (payload.movie ?? data?.movie ?? data) as MovieDetail | undefined;
  const episodes = (payload.episodes ?? data?.episodes ?? movie?.episodes ?? []) as MovieDetail["episodes"];
  return movie ? { ...movie, episodes } : null;
}

function isPlayableStream(url?: string | null) {
  return Boolean(url && url !== "null" && url !== "undefined" && !url.includes("url=null") && !url.includes("url=undefined"));
}

function findEpisode(movie: MovieDetail, selected?: string): EpisodeLink | undefined {
  const episodes = movie.episodes?.flatMap((server) => server.server_data) ?? [];
  const selectedEpisode = episodes.find((episode) => (episode.slug === selected || episode.name === selected) && isPlayableStream(episode.link_m3u8));
  return selectedEpisode ?? episodes.find((episode) => isPlayableStream(episode.link_m3u8));
}

function episodeNumber(episode?: EpisodeLink) {
  const raw = `${episode?.slug ?? ""} ${episode?.name ?? ""}`;
  const match = raw.match(/(?:tap|episode|ep)[^\d]*(\d+)/i) ?? raw.match(/\b(\d{1,3})\b/);
  return match ? Number(match[1]) : 1;
}

export default async function MoviePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ episode?: string }> }) {
  const { slug } = await params;
  const { episode } = await searchParams;
  const movie = await getMovie(slug);
  if (!movie) notFound();
  const activeEpisode = findEpisode(movie, episode);
  const season = Number(movie.tmdb?.season ?? 1);
  const episodeNo = episodeNumber(activeEpisode);
  const supabase = await createSupabaseServerClient();
  const { data: introMarker } = await supabase
    .from("intro_markers")
    .select("start_time,end_time")
    .eq("movie_slug", movie.slug)
    .maybeSingle();
  const introDbSegment = await fetchIntroDbSegment({ imdbId: movie.imdb?.id, season, episode: episodeNo });
  const introStart = introDbSegment?.start ?? Number(introMarker?.start_time ?? 0);
  const introEnd = introDbSegment?.end ?? Number(introMarker?.end_time ?? 0);

  return (
    <MotionShell>
      <section className="relative min-h-[56vh] overflow-hidden pt-16 sm:min-h-[62vh]">
        <img src={movie.thumb_url || movie.poster_url} alt={movie.name} className="absolute inset-0 h-full w-full object-cover opacity-55" />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/20" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#0a0a0a] to-transparent" />
        <div className="relative mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-8 sm:py-16 lg:grid-cols-[280px_1fr]">
          <img src={movie.poster_url || movie.thumb_url} alt={movie.name} className="hidden aspect-[2/3] w-full rounded-md border border-white/10 object-cover shadow-2xl shadow-black/60 lg:block" />
          <div className="flex max-w-3xl flex-col justify-end">
            <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-slate-200 sm:gap-3 sm:text-sm">
              {movie.tmdb?.vote_average && <span className="inline-flex items-center gap-1 rounded-md bg-amber-300/15 px-3 py-1 text-amber-200"><Star size={15} /> {movie.tmdb.vote_average.toFixed?.(1) ?? movie.tmdb.vote_average}</span>}
              <span>{movie.year}</span><span>{movie.quality}</span><span>{movie.lang}</span><span>{movie.time}</span>
            </div>
            <h1 className="text-3xl font-black text-white sm:text-5xl lg:text-6xl">{movie.name}</h1>
            <p className="mt-3 text-base text-slate-300 sm:text-xl">{movie.origin_name}</p>
            <p className="mt-5 line-clamp-5 max-w-2xl text-sm leading-6 text-slate-200 sm:text-base sm:leading-7">{stripHtml(movie.content)}</p>
            <div className="mt-7"><MovieActions movie={movie} /></div>
            <CreateWatchPartyButton movie={movie} streamUrl={activeEpisode?.link_m3u8} episodeName={activeEpisode?.name} introStart={introStart} introEnd={introEnd} />
            <JoinWatchPartyForm />
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-7xl gap-5 px-3 pb-20 sm:gap-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <VideoPlayer src={activeEpisode?.link_m3u8} poster={movie.thumb_url || movie.poster_url} resumeKey={`${movie.slug}:${activeEpisode?.slug ?? activeEpisode?.name ?? "default"}`} introStart={introStart} introEnd={introEnd} />
        </div>
        <aside className="rounded-lg border border-white/10 bg-white/5 p-3 backdrop-blur-xl sm:p-4">
          <h2 className="mb-4 text-lg font-bold text-white">Episodes</h2>
          <div className="grid max-h-[360px] gap-2 overflow-y-auto pr-1 sm:max-h-[520px]">
            {movie.episodes?.flatMap((server) =>
              server.server_data.map((episode) => (
                <Button key={`${server.server_name}-${episode.name}`} asChild variant={episode.link_m3u8 === activeEpisode?.link_m3u8 ? "default" : "glass"} className="justify-start">
                  <a href={`/movie/${movie.slug}?episode=${encodeURIComponent(episode.slug ?? episode.name)}`}>{episode.name}</a>
                </Button>
              )),
            )}
          </div>
        </aside>
      </section>
    </MotionShell>
  );
}
