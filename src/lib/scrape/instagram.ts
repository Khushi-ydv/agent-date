import { runApifyActor } from "./apify";
import { InstagramPost, InstagramProfile, ScrapeError } from "./types";
import { UA, decodeHtml, decodeJsonString, fetchText, parseCount, sleep } from "./util";

export function parseInstagramUsername(input: string): string {
  const s = input.trim();
  const m = s.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  const u = (m ? m[1] : s.replace(/^@/, "")).replace(/\/$/, "");
  if (!/^[A-Za-z0-9._]{1,30}$/.test(u) || ["p", "reel", "explore", "stories"].includes(u)) {
    throw new ScrapeError(`Not a valid Instagram profile link: ${input}`);
  }
  return u.toLowerCase();
}

/** Strategy 1: Instagram's own web API (richest data, but rate-limited per IP). */
async function viaWebApi(username: string): Promise<InstagramProfile> {
  const { status, text } = await fetchText(
    `https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`,
    {
      "User-Agent": UA.chrome,
      "x-ig-app-id": "936619743392459",
      "X-Requested-With": "XMLHttpRequest",
      Referer: `https://www.instagram.com/${username}/`,
      Accept: "*/*",
    }
  );
  if (status !== 200) throw new Error(`web api ${status}`);
  const user = JSON.parse(text)?.data?.user;
  if (!user) throw new Error("web api: no user");
  const edges = user.edge_owner_to_timeline_media?.edges ?? [];
  return {
    source: "instagram",
    method: "instagram-web-api",
    username,
    url: `https://www.instagram.com/${username}/`,
    fullName: user.full_name,
    bio: user.biography,
    followers: user.edge_followed_by?.count,
    following: user.edge_follow?.count,
    postsCount: user.edge_owner_to_timeline_media?.count,
    isVerified: user.is_verified,
    isPrivate: user.is_private,
    profilePic: user.profile_pic_url_hd || user.profile_pic_url,
    externalUrl: user.external_url,
    category: user.category_name,
    posts: edges.slice(0, 12).map((e: any) => ({
      caption: e.node?.edge_media_to_caption?.edges?.[0]?.node?.text ?? "",
      imageUrl: e.node?.display_url,
      type: e.node?.is_video ? "video" : e.node?.__typename,
    })),
  };
}

/** Strategy 2: logged-out profile HTML served to link-preview crawlers; contains embedded JSON + captions. */
async function viaCrawlerHtml(username: string): Promise<InstagramProfile> {
  let lastErr = "";
  let thin: InstagramProfile | undefined; // stats-only result, used if no richer page comes back
  // Search-engine UAs get the full embedded JSON (bio + 12 posts); facebookexternalhit only gets meta tags.
  for (const ua of [UA.googlebot, UA.bingbot, UA.facebook]) {
    const { status, text: h } = await fetchText(`https://www.instagram.com/${username}/`, {
      "User-Agent": ua,
      "Accept-Language": "en-US,en;q=0.9",
    });
    if (status === 404) throw new ScrapeError(`Instagram user @${username} not found`);
    if (status !== 200 || !h.includes("og:")) {
      lastErr = `html ${status}`;
      continue;
    }
    const str = (key: string) => {
      const m = h.match(new RegExp(`"${key}":"((?:[^"\\\\]|\\\\.)*)"`));
      return m ? decodeJsonString(m[1]) : undefined;
    };
    const num = (key: string) => {
      const m = h.match(new RegExp(`"${key}":(\\d+)`));
      return m ? Number(m[1]) : undefined;
    };
    const bool = (key: string) => {
      const m = h.match(new RegExp(`"${key}":(true|false)`));
      return m ? m[1] === "true" : undefined;
    };
    const meta = (prop: string) => {
      const m = h.match(new RegExp(`<meta (?:property|name)="${prop}" content="([^"]*)"`));
      return m ? decodeHtml(m[1]) : undefined;
    };

    // Posts: each media node has display_uri ... caption:{text}
    const posts: InstagramPost[] = [];
    const re = /"display_uri":"((?:[^"\\]|\\.)*)"[\s\S]{0,400}?"caption":(null|\{"pk":"\d+","text":"((?:[^"\\]|\\.)*)")/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(h)) && posts.length < 12) {
      posts.push({ imageUrl: decodeJsonString(m[1]), caption: m[3] ? decodeJsonString(m[3]) : "" });
    }
    if (!posts.length) {
      const capRe = /"caption":\{"pk":"\d+","text":"((?:[^"\\]|\\.)*)"/g;
      while ((m = capRe.exec(h)) && posts.length < 12) posts.push({ caption: decodeJsonString(m[1]) });
    }

    // og:description: "268M Followers, 195 Following, 32K Posts - See Instagram photos and videos from ..."
    const og = meta("og:description") ?? "";
    const ogM = og.match(/([\d.,]+[KMB]?) Followers, ([\d.,]+[KMB]?) Following, ([\d.,]+[KMB]?) Posts/i);
    const ogTitle = meta("og:title") ?? "";

    const profile: InstagramProfile = {
      source: "instagram",
      method: `instagram-crawler-html (${ua.split("/")[0]})`,
      username,
      url: `https://www.instagram.com/${username}/`,
      fullName: str("full_name") ?? ogTitle.replace(/\s*\(@.*$/, "").trim(),
      bio: str("biography"),
      followers: num("follower_count") ?? parseCount(ogM?.[1]),
      following: num("following_count") ?? parseCount(ogM?.[2]),
      postsCount: parseCount(ogM?.[3]),
      isVerified: bool("is_verified"),
      isPrivate: bool("is_private"),
      profilePic: str("profile_pic_url") ?? meta("og:image"),
      externalUrl: str("external_url"),
      category: str("category_name"),
      posts,
    };
    if (!profile.bio && !posts.length) {
      thin ??= profile.fullName || profile.followers ? profile : undefined;
      lastErr = "html had no bio/posts";
      continue;
    }
    return profile;
  }
  if (thin) return thin;
  throw new Error(lastErr || "crawler html failed");
}

/** Strategy 3: Apify official Instagram scraper (only if APIFY_TOKEN is set). */
async function viaApify(username: string): Promise<InstagramProfile> {
  const items = await runApifyActor<any>("apify/instagram-profile-scraper", { usernames: [username], resultsLimit: 12 });
  const u = items[0];
  if (!u || u.error) throw new Error(`apify: ${u?.error ?? "no result"}`);
  return {
    source: "instagram",
    method: "apify/instagram-profile-scraper",
    username,
    url: `https://www.instagram.com/${username}/`,
    fullName: u.fullName,
    bio: u.biography,
    followers: u.followersCount,
    following: u.followsCount,
    postsCount: u.postsCount,
    isVerified: u.verified,
    isPrivate: u.private,
    profilePic: u.profilePicUrlHD || u.profilePicUrl,
    externalUrl: u.externalUrl,
    category: u.businessCategoryName,
    posts: (u.latestPosts ?? []).slice(0, 12).map((p: any) => ({
      caption: p.caption ?? "",
      imageUrl: p.displayUrl,
      type: p.type,
    })),
  };
}

export async function scrapeInstagram(input: string): Promise<InstagramProfile> {
  const username = parseInstagramUsername(input);
  const attempts: string[] = [];
  const strategies: [string, () => Promise<InstagramProfile>][] = [
    ["crawler-html", () => viaCrawlerHtml(username)],
    ["web-api", () => viaWebApi(username)],
  ];
  if (process.env.APIFY_TOKEN) strategies.push(["apify", () => viaApify(username)]);

  for (const [name, fn] of strategies) {
    for (let i = 0; i < 2; i++) {
      try {
        const p = await fn();
        if (p.isPrivate) throw new ScrapeError(`@${username} is a private account — only public profiles are supported`);
        return p;
      } catch (e) {
        if (e instanceof ScrapeError) throw e;
        attempts.push(`${name}#${i + 1}: ${(e as Error).message}`);
        await sleep(800 + Math.random() * 700);
      }
    }
  }
  throw new ScrapeError(`Could not read Instagram @${username}`, attempts);
}
