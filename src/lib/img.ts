/** Local images (bundled demo photos) load directly; remote CDN images go through our proxy. */
export const imgSrc = (u: string) => (u.startsWith("/") ? u : `/api/img?u=${encodeURIComponent(u)}`);
