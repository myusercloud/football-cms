#!/usr/bin/env node
/**
 * Seed script — populates Strapi CMS from footballke/data/*.json files.
 *
 * Usage (from footballke-cms/ directory):
 *   node scripts/seed.mjs
 *
 * Env vars (optional — falls back to defaults):
 *   STRAPI_URL            default: http://localhost:3001
 *   STRAPI_ADMIN_EMAIL    default: admin@footballke.com
 *   STRAPI_ADMIN_PASSWORD default: Admin1234!
 *
 * Covers: categories, authors, clubs, players, articles,
 *         fixtures, standings, transfers, tournaments
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const envPath = resolve(__dirname, '../.env')
try {
  readFileSync(envPath, 'utf8')
    .split('\n')
    .forEach(line => {
      const [key, ...rest] = line.split('=')
      if (key && rest.length && !process.env[key.trim()]) {
        process.env[key.trim()] = rest.join('=').trim()
      }
    })
} catch { /* .env is optional */ }

const DATA_DIR = resolve(__dirname, '../../footballke/data')
const BASE_URL = process.env.STRAPI_URL            ?? 'http://localhost:3001'
const EMAIL    = process.env.STRAPI_ADMIN_EMAIL    ?? 'admin@footballke.com'
const PASSWORD = process.env.STRAPI_ADMIN_PASSWORD ?? 'Admin1234!'

// ── JSON loaders ──────────────────────────────────────────────────────────────

function loadJson(file) {
  return JSON.parse(readFileSync(resolve(DATA_DIR, file), 'utf8'))
}

// ── Strapi helpers ────────────────────────────────────────────────────────────

let token = null

async function login() {
  const res = await fetch(`${BASE_URL}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Login failed (${res.status}): ${text}`)
  }
  const { data } = await res.json()
  token = data.token
  console.log('✓ Logged in as', EMAIL)
}

async function apiGet(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`)
  return res.json()
}

async function cmsCreate(uid, data) {
  const res = await fetch(`${BASE_URL}/content-manager/collection-types/${uid}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`POST ${uid} → ${res.status}: ${text}`)
  }
  return res.json()
}

async function cmsPublish(uid, documentId) {
  const res = await fetch(
    `${BASE_URL}/content-manager/collection-types/${uid}/${documentId}/actions/publish`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Publish ${uid}/${documentId} → ${res.status}: ${text}`)
  }
  return res.json()
}

async function findBySlug(uid, slug) {
  const res = await apiGet(
    `/content-manager/collection-types/${uid}?filters[slug][$eq]=${encodeURIComponent(slug)}&pagination[pageSize]=1`
  )
  return res?.results?.[0]?.documentId ?? null
}

async function countAll(uid) {
  const res = await apiGet(
    `/content-manager/collection-types/${uid}?pagination[pageSize]=1&pagination[page]=1`
  )
  return res?.pagination?.total ?? 0
}

// ── Content converter: JSON ContentBlock[] → TipTap JSON string ──────────────

function blockToTipTap(block) {
  switch (block.type) {
    case 'paragraph':
      return { type: 'paragraph', content: [{ type: 'text', text: block.text }] }

    case 'rich-paragraph':
      return {
        type: 'paragraph',
        content: block.children.map(node =>
          node.type === 'mention'
            ? {
                type: 'mention',
                attrs: {
                  id:         node.entitySlug,
                  entityType: node.entityType,
                  entitySlug: node.entitySlug,
                  entityName: node.entityName,
                  href:       node.href,
                },
              }
            : {
                type: 'text',
                text: node.text,
                ...(node.bold   ? { marks: [{ type: 'bold' }] }   : {}),
                ...(node.italic ? { marks: [{ type: 'italic' }] } : {}),
              }
        ),
      }

    case 'heading':
      return {
        type: 'heading',
        attrs: { level: block.level },
        content: [{ type: 'text', text: block.text }],
      }

    case 'quote':
      return {
        type: 'blockquote',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: block.text },
              ...(block.attribution ? [{ type: 'text', text: `\n— ${block.attribution}` }] : []),
            ],
          },
        ],
      }

    case 'list':
      return {
        type: block.ordered ? 'orderedList' : 'bulletList',
        content: block.items.map(item => ({
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: item }] }],
        })),
      }

    case 'image':
      return { type: 'paragraph', content: [{ type: 'text', text: `[Image: ${block.alt}]` }] }

    default:
      return null
  }
}

function contentBlocksToTipTap(blocks) {
  const nodes = Array.isArray(blocks) ? blocks.map(blockToTipTap).filter(Boolean) : []
  return JSON.stringify({ type: 'doc', content: nodes })
}

// ── Club data map (by slug and by slug-without-fc for sloppy transfer refs) ──

function buildClubDataMap(clubs) {
  const map = {}
  for (const club of clubs) {
    map[club.id]   = club
    map[club.slug] = club
    const short = club.id.replace(/-fc$/, '')
    if (short !== club.id) map[short] = club
  }
  return map
}

// ── Seed functions ────────────────────────────────────────────────────────────

async function seedCategories(categories) {
  console.log('\n── Categories ──')
  const map = {}
  for (const cat of categories) {
    const existing = await findBySlug('api::category.category', cat.slug)
    if (existing) {
      console.log(`  skip  ${cat.name}`)
      map[cat.id] = existing
      continue
    }
    const created = await cmsCreate('api::category.category', {
      name: cat.name, slug: cat.slug, color: cat.color,
    })
    map[cat.id] = created.documentId ?? created.data?.documentId
    console.log(`  ✓ ${cat.name}`)
  }
  return map
}

async function seedAuthors(authors) {
  console.log('\n── Authors ──')
  const map = {}
  for (const author of authors) {
    const list = await apiGet(
      `/content-manager/collection-types/api::author.author?filters[name][$eq]=${encodeURIComponent(author.name)}&pagination[pageSize]=1`
    )
    const existing = list?.results?.[0]?.documentId
    if (existing) {
      console.log(`  skip  ${author.name}`)
      map[author.id] = existing
      continue
    }
    const created = await cmsCreate('api::author.author', {
      name: author.name, role: author.role, bio: author.bio ?? '',
    })
    map[author.id] = created.documentId ?? created.data?.documentId
    console.log(`  ✓ ${author.name}`)
  }
  return map
}

async function seedClubs(clubs) {
  console.log('\n── Clubs ──')
  const map = {}
  for (const club of clubs) {
    const existing = await findBySlug('api::club.club', club.slug)
    if (existing) {
      console.log(`  skip  ${club.name}`)
      map[club.slug] = existing
      continue
    }
    const created = await cmsCreate('api::club.club', {
      name:           club.name,
      slug:           club.slug,
      shortName:      club.shortName,
      abbreviation:   club.abbreviation,
      founded:        club.founded,
      city:           club.city,
      country:        club.country ?? 'Kenya',
      primaryColor:   club.colors?.primary  ?? '#000000',
      secondaryColor: club.colors?.secondary ?? '#ffffff',
      venueName:      club.venue?.name,
      venueCity:      club.venue?.city,
      venueCapacity:  club.venue?.capacity,
      description:    club.description,
      achievements:   club.achievements ?? [],
      twitterUrl:     club.social?.twitter,
      facebookUrl:    club.social?.facebook,
      instagramUrl:   club.social?.instagram,
      websiteUrl:     club.social?.website,
    })
    map[club.slug] = created.documentId ?? created.data?.documentId
    console.log(`  ✓ ${club.name}`)
  }
  return map
}

async function seedPlayers(players, clubDocMap) {
  console.log('\n── Players ──')
  for (const player of players) {
    const existing = await findBySlug('api::player.player', player.slug)
    if (existing) {
      console.log(`  skip  ${player.name}`)
      continue
    }
    const clubDocId = clubDocMap[player.clubSlug] ?? clubDocMap[player.clubId]
    await cmsCreate('api::player.player', {
      name:               player.name,
      slug:               player.slug,
      jerseyNumber:       player.jerseyNumber,
      position:           player.position,
      secondaryPosition:  player.secondaryPosition ?? undefined,
      nationalityName:    player.nationality?.name  ?? 'Kenyan',
      nationalityCode:    player.nationality?.code  ?? 'KE',
      nationalityFlag:    player.nationality?.flag  ?? '/flags/ke.svg',
      dateOfBirth:        player.dateOfBirth,
      height:             player.height,
      preferredFoot:      player.preferredFoot,
      contractUntil:      player.contract?.until,
      contractType:       player.contract?.type ?? 'permanent',
      bio:                player.bio,
      statsAppearances:   player.stats?.appearances   ?? 0,
      statsGoals:         player.stats?.goals         ?? 0,
      statsAssists:       player.stats?.assists       ?? 0,
      statsYellowCards:   player.stats?.yellowCards   ?? 0,
      statsRedCards:      player.stats?.redCards      ?? 0,
      statsMinutesPlayed: player.stats?.minutesPlayed ?? 0,
      statsCleanSheets:   player.stats?.cleanSheets   ?? 0,
      ...(clubDocId ? { club: { connect: [{ documentId: clubDocId }] } } : {}),
    })
    console.log(`  ✓ ${player.name}`)
  }
}

async function seedArticles(articles, categoryMap, authorMap) {
  console.log('\n── Articles ──')
  for (const article of articles) {
    const existing = await findBySlug('api::article.article', article.slug)
    if (existing) {
      console.log(`  skip  "${article.title}"`)
      continue
    }
    const catDocId    = categoryMap[article.categoryId]
      ?? await findBySlug('api::category.category', article.categorySlug)
    const authorDocId = authorMap[article.authorId]
    const content     = contentBlocksToTipTap(article.content)

    const created = await cmsCreate('api::article.article', {
      title:    article.title,
      slug:     article.slug,
      excerpt:  article.excerpt,
      content,
      featured: article.featured ?? false,
      ...(catDocId    ? { category: { connect: [{ documentId: catDocId }] } }    : {}),
      ...(authorDocId ? { author:   { connect: [{ documentId: authorDocId }] } } : {}),
    })
    console.log(`  ✓ "${article.title}"`)
  }
}

async function seedFixtures(fixtures, competitions, clubDataMap) {
  console.log('\n── Fixtures ──')
  const total = await countAll('api::fixture.fixture')
  if (total > 0) {
    console.log(`  skip  (${total} already exist)`)
    return
  }

  const compMap = {}
  for (const c of competitions) compMap[c.id] = c

  for (const f of fixtures) {
    const home = clubDataMap[f.homeTeamId]
    const away = clubDataMap[f.awayTeamId]
    const comp = compMap[f.competitionId]

    if (!comp) {
      console.log(`  warn  unknown competition "${f.competitionId}" — skipping`)
      continue
    }

    await cmsCreate('api::fixture.fixture', {
      matchStatus:          f.status,
      kickoff:              f.kickoff,
      matchday:             f.matchday ?? null,
      featured:             f.featured ?? false,
      homeTeamId:           f.homeTeamId,
      homeTeamName:         home?.name             ?? f.homeTeamId,
      homeTeamShortName:    home?.shortName         ?? f.homeTeamId,
      homeTeamAbbreviation: home?.abbreviation      ?? f.homeTeamId.slice(0, 3).toUpperCase(),
      homeTeamSlug:         home?.slug              ?? f.homeTeamId,
      homeTeamLogo:         home?.logo              ?? `/clubs/${f.homeTeamId}.svg`,
      homeTeamPrimaryColor: home?.colors?.primary   ?? '#000000',
      awayTeamId:           f.awayTeamId,
      awayTeamName:         away?.name              ?? f.awayTeamId,
      awayTeamShortName:    away?.shortName         ?? f.awayTeamId,
      awayTeamAbbreviation: away?.abbreviation      ?? f.awayTeamId.slice(0, 3).toUpperCase(),
      awayTeamSlug:         away?.slug              ?? f.awayTeamId,
      awayTeamLogo:         away?.logo              ?? `/clubs/${f.awayTeamId}.svg`,
      awayTeamPrimaryColor: away?.colors?.primary   ?? '#000000',
      competitionId:        comp.id,
      competitionName:      comp.name,
      competitionSlug:      comp.slug,
      competitionSeason:    comp.season             ?? '2025/26',
      venueName:            home?.venue?.name       ?? null,
      venueCity:            home?.venue?.city       ?? null,
      scoreHome:            f.score?.home           ?? null,
      scoreAway:            f.score?.away           ?? null,
      liveMinute:           f.liveMinute            ?? null,
      preview:              f.preview               ?? null,
    })
    console.log(`  ✓ ${home?.shortName ?? f.homeTeamId} v ${away?.shortName ?? f.awayTeamId}`)
  }
}

async function seedStandings(standings, competitions, clubDataMap) {
  console.log('\n── Standings ──')
  const total = await countAll('api::standing.standing')
  if (total > 0) {
    console.log(`  skip  (${total} already exist)`)
    return
  }

  const compMap = {}
  for (const c of competitions) compMap[c.id] = c

  for (const standing of standings) {
    const comp = compMap[standing.competitionId]
    if (!comp) {
      console.log(`  warn  unknown competition "${standing.competitionId}" — skipping`)
      continue
    }

    const enrichedRows = standing.rows.map((row, i) => {
      const club = clubDataMap[row.clubId]
      return {
        position:       i + 1,
        clubId:         row.clubId,
        clubName:       club?.name            ?? row.clubId,
        clubShortName:  club?.shortName       ?? row.clubId,
        clubSlug:       club?.slug            ?? row.clubId,
        clubLogo:       club?.logo            ?? `/clubs/${row.clubId}.svg`,
        primaryColor:   club?.colors?.primary ?? '#000000',
        played:         row.played,
        won:            row.won,
        drawn:          row.drawn,
        lost:           row.lost,
        goalsFor:       row.goalsFor,
        goalsAgainst:   row.goalsAgainst,
        goalDifference: (row.goalsFor ?? 0) - (row.goalsAgainst ?? 0),
        points:         (row.won ?? 0) * 3 + (row.drawn ?? 0),
        form:           row.form ?? [],
      }
    })

    await cmsCreate('api::standing.standing', {
      competitionId:      comp.id,
      competitionName:    comp.name,
      competitionSlug:    comp.slug,
      competitionLogo:    comp.logo             ?? `/images/competitions/${comp.id}.png`,
      competitionCountry: comp.country          ?? 'Kenya',
      seasonId:           standing.season?.id   ?? '2025-26',
      seasonLabel:        standing.season?.label ?? '2025/26',
      zones:              standing.zones         ?? null,
      rows:               enrichedRows,
    })
    console.log(`  ✓ ${comp.name} ${standing.season?.label}`)
  }
}

async function seedTransfers(transfers, clubDataMap) {
  console.log('\n── Transfers ──')
  const total = await countAll('api::transfer.transfer')
  if (total > 0) {
    console.log(`  skip  (${total} already exist)`)
    return
  }

  for (const t of transfers) {
    const fromClub = clubDataMap[t.fromClubId]
    const toClub   = clubDataMap[t.toClubId]

    await cmsCreate('api::transfer.transfer', {
      playerName:        t.player?.name        ?? t.playerName,
      playerPosition:    t.player?.position    ?? t.playerPosition,
      playerNationality: t.player?.nationality ?? t.playerNationality,
      playerAge:         t.player?.age         ?? t.playerAge   ?? null,
      fromClubName:      fromClub?.name        ?? t.fromClubId  ?? null,
      fromClubShortName: fromClub?.shortName   ?? t.fromClubId  ?? null,
      fromClubSlug:      fromClub?.slug        ?? t.fromClubId  ?? null,
      fromClubCountry:   fromClub?.country     ?? null,
      toClubName:        toClub?.name          ?? t.toClubId    ?? null,
      toClubShortName:   toClub?.shortName     ?? t.toClubId    ?? null,
      toClubSlug:        toClub?.slug          ?? t.toClubId    ?? null,
      toClubCountry:     toClub?.country       ?? null,
      fee:               t.fee                 ?? null,
      transferStatus:    t.status,
      confidence:        t.confidence          ?? null,
      window:            t.window,
      transferDate:      (t.date ?? new Date().toISOString()).slice(0, 10),
      sourceLabel:       t.sourceLabel         ?? null,
      linkedArticleSlug: t.linkedArticleSlug   ?? null,
    })
    console.log(`  ✓ ${t.player?.name} → ${toClub?.shortName ?? t.toClubId ?? 'Unknown'}`)
  }
}

async function seedTournaments() {
  console.log('\n── Tournaments ──')
  const total = await countAll('api::tournament.tournament')
  if (total > 0) {
    console.log(`  skip  (${total} already exist)`)
    return
  }

  const tournaments = [
    {
      name:         'Kenyan Premier League',
      slug:         'kpl',
      shortName:    'KPL',
      edition:      '2025/26',
      totalTeams:   18,
      featured:     true,
      hostCountries:['Kenya'],
      hostCities:   ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru'],
      startDate:    '2025-09-01',
      endDate:      '2026-06-30',
      currentPhase: 'group',
    },
    {
      name:         'FKF Cup',
      slug:         'fkf-cup',
      shortName:    'FKF Cup',
      edition:      '2024/25',
      totalTeams:   32,
      featured:     false,
      hostCountries:['Kenya'],
      hostCities:   ['Nairobi'],
      startDate:    '2024-11-01',
      endDate:      '2025-05-31',
      knockoutStart:'2024-11-01',
      currentPhase: 'quarter-final',
    },
    {
      name:         'CECAFA Club Championship',
      slug:         'cecafa-club',
      shortName:    'CECAFA',
      edition:      '2025',
      totalTeams:   16,
      featured:     false,
      hostCountries:['Tanzania'],
      hostCities:   ['Dar es Salaam'],
      startDate:    '2025-12-01',
      endDate:      '2025-12-21',
      groupStageEnd:'2025-12-10',
      knockoutStart:'2025-12-11',
      currentPhase: 'semi-final',
    },
  ]

  for (const t of tournaments) {
    const existing = await findBySlug('api::tournament.tournament', t.slug)
    if (existing) {
      console.log(`  skip  ${t.name}`)
      continue
    }
    await cmsCreate('api::tournament.tournament', t)
    console.log(`  ✓ ${t.name} ${t.edition}`)
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Seeding ${BASE_URL} …`)

  await login()

  const { categories, authors, articles }               = loadJson('news.json')
  const { clubs }                                        = loadJson('clubs.json')
  const { players }                                      = loadJson('players.json')
  const { fixtures, competitions: fixtureComps }        = loadJson('fixtures.json')
  const { standings, competitions: standingComps }      = loadJson('standings.json')
  const { transfers }                                    = loadJson('transfers.json')

  const clubDataMap = buildClubDataMap(clubs)

  const categoryMap = await seedCategories(categories)
  const authorMap   = await seedAuthors(authors)
  const clubDocMap  = await seedClubs(clubs)
  await seedPlayers(players, clubDocMap)
  await seedArticles(articles, categoryMap, authorMap)
  await seedFixtures(fixtures, fixtureComps, clubDataMap)
  await seedStandings(standings, standingComps, clubDataMap)
  await seedTransfers(transfers, clubDataMap)
  await seedTournaments()

  console.log('\n✅ Seed complete.')
}

main().catch(err => {
  console.error('\n❌ Seed failed:', err.message)
  process.exit(1)
})
