# Crawling Strategy

## Crawl4AI Setup

- Local Flask instance at `http://localhost:11235`
- Magic flag enabled for JS-rendered content
- `flatten_shadow_dom: true` for shadow DOM content
- `check_robots_txt: true` to respect restrictions

## Scope

Primary target: `https://web.uettaxila.edu.pk/`

- Admission pages (programs, fee structures, schedules)
- Department pages (faculty, courses, research)
- Campus life (events, facilities, policies)
- Official notices and announcements

## Exclusions

- External links (unless explicitly included)
- File downloads (PDFs, images — metadata only)
- Login-protected pages

## TODO

- [ ] Implement crawl job manager in Convex
- [ ] Add rate limiting and politeness delays
- [ ] Handle incremental re-crawls (schedule-based)
- [ ] Add crawl status monitoring UI
