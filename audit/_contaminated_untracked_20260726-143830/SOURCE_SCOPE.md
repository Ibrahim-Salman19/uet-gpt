# UET Taxila Host & Content-Scope Registry

## 1. Host Classification & Scope Registry

| Host / Subdomain | Scope State | Authority Level | Inclusion Rationale / Boundary Rules |
| :--- | :--- | :--- | :--- |
| `https://www.uettaxila.edu.pk/` | Included official public source | Primary Institutional | Main institutional portal; redirect target for default web traffic. |
| `https://web.uettaxila.edu.pk/` | Included official public source | Primary Academic & Admin | Core site hosting academic departments, examination notices, hostels, transport, RTI, and rules. |
| `https://admissions.uettaxila.edu.pk/` | Included official public source | Primary Admissions | Official portal for undergraduate and postgraduate admissions, prospectuses, fee schedules, and merit lists. |
| `web.uettaxila.edu.pk/EED/` | Included for selected paths | Departmental Primary | Electrical Engineering Department site. |
| `web.uettaxila.edu.pk/MED/` | Included for selected paths | Departmental Primary | Mechanical Engineering Department site. |
| `web.uettaxila.edu.pk/CED/` | Included for selected paths | Departmental Primary | Civil Engineering Department site. |
| `web.uettaxila.edu.pk/Faculty/` | Included for selected paths | Institutional Directory | Official faculty directory and Dean office pages. |
| `web.uettaxila.edu.pk/PageContents/` | Included for selected paths | Official Notices & Downloads | Directory hosting PDF schedules, allotment policies, and transport route maps. |
| `hec.gov.pk` | External authoritative reference | External Benchmark | Referenced for national equivalence, accreditation, and scholarship policy context. |
| `pec.org.pk` | External authoritative reference | External Accreditation | Referenced for engineering accreditation standards and outcome-based education (OBE) criteria. |
| `lms.uettaxila.edu.pk` | **Excluded operational system** | Authenticated Private | Learning Management System (LMS) — requires student authentication; excluded. |
| `mis.uettaxila.edu.pk` | **Excluded operational system** | Authenticated Private | Management Information System (MIS) — private employee/student records; excluded. |
| `amsys.uettaxila.edu.pk` | **Excluded operational system** | Authenticated Private | Academic Management System — private grades and attendance; excluded. |
| `outlook.office365.com` | **Excluded operational system** | Private Email | University webmail login; excluded. |

---

## 2. Route Family Inventory

| Pattern | Host | Page Type | Parser Required | Crawl Priority | Update Volatility | Known Failure Mode |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/*.php` | `admissions.uettaxila.edu.pk` | Admissions Forms & Schedules | Trafilatura | High | High (Weekly) | Query param variations (`?id=1`) causing duplicate crawl scheduling. |
| `/*.asp` | `web.uettaxila.edu.pk` | Legacy Department Pages | BeautifulSoup + Trafilatura | High | Medium (Monthly) | Legacy HTML encoding (Windows-1252) creating mojibake before UTF-8 normalization. |
| `/*.aspx` | `web.uettaxila.edu.pk` | Department & Faculty Pages | BeautifulSoup + Trafilatura | High | Medium (Monthly) | ViewState hidden input fields (`__VIEWSTATE`) leaking noise tokens into text parser. |
| `/*.pdf` | Both | Official Prospectuses, Regulations & Schedules | PyMuPDF4LLM / VLM | Critical | Medium (Per Session) | Large response size (>15MB) causing timeout or memory pressure without buffer cap. |

---

## 3. Discovery Mechanisms & Orphan Detection

1. **robots.txt:** Evaluated per host with Chrome UA impersonation.
2. **XML Sitemaps:** Fallback discovery for extensionless routes.
3. **Breadcrumbs & Footers:** Crawled to depth 4 using explicit domain allowlists.
4. **PDF Link Extraction:** Links embedded inside prospectuses and notices are parsed and added to the discovery queue.
5. **Dead Letter Queue (DLQ):** Failed requests (e.g. invalid `departmentId` queries) are automatically isolated in `dlq.jsonl` to prevent infinite crawl retry loops.
