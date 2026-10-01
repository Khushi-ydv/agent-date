export interface InstagramPost {
  caption: string;
  imageUrl?: string;
  type?: string; // feed | clips | carousel
}

export interface InstagramProfile {
  source: "instagram";
  method: string; // which scraper strategy succeeded
  username: string;
  url: string;
  fullName?: string;
  bio?: string;
  followers?: number;
  following?: number;
  postsCount?: number;
  isVerified?: boolean;
  isPrivate?: boolean;
  profilePic?: string;
  externalUrl?: string;
  category?: string;
  posts: InstagramPost[];
}

export interface LinkedInEntry {
  title?: string;
  org?: string;
  start?: string | number;
  end?: string | number;
}

export interface LinkedInProfile {
  source: "linkedin";
  method: string;
  slug: string;
  url: string;
  name?: string;
  headline?: string;
  about?: string;
  location?: string;
  profilePic?: string;
  followers?: number;
  experience: LinkedInEntry[];
  education: LinkedInEntry[];
  languages: string[];
  posts: { text: string; date?: string; kind: string }[];
  activityText?: string; // plain text of the public "Activity" section (recent posts/reshares)
}

export class ScrapeError extends Error {
  constructor(message: string, public attempts: string[] = []) {
    super(message);
  }
}
