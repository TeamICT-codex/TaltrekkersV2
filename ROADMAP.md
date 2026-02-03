# TaalTrekkers Roadmap

## 🚀 Gepland (Backlog)

### TeacherDashboard Progressie Tracking
**Prioriteit:** Medium | **Complexiteit:** Hoog (⭐⭐⭐⭐)

Integreer woordenlijst progressie tracking in het TeacherDashboard zodat leerkrachten kunnen zien:
- Hoeveel woorden elke leerling per lijst heeft geoefend
- Percentage gekende vs te oefenen woorden per leerling
- Progress bars per woordenlijst

**Te doen:**
- [ ] Supabase schema uitbreiden met `word_list_progress` tabel
- [ ] Data sync implementeren tussen lokale opslag en Supabase
- [ ] TeacherDashboard UI aanpassen om progress te tonen
- [ ] Per-student overzicht met woordenlijst statistieken

**Afhankelijkheden:**
- Vereist Supabase database aanpassingen
- Lokale `wordListProgress` data moet worden gesynchroniseerd naar cloud

---

## ✅ Recent Afgerond

### Woordenlijst Progressie Tracking (Lokaal)
- Progress indicators in Welcome page (👁️ X/Y + progress bars)
- LearnedWordsView met stats t.o.v. volledige woordenlijst
- Gamification celebration modals voor voltooide lijsten
- Smart word rotation (onbekende woorden krijgen prioriteit)
