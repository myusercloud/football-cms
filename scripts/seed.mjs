#!/usr/bin/env node
/**
 * Seed script — reads from footballke/data/*.json and populates Strapi CMS.
 *
 * Usage (from footballke-cms/ directory):
 *   node scripts/seed.mjs
 *
 * Env vars (optional — falls back to Strapi defaults):
 *   STRAPI_URL            default: http://localhost:3001
 *   STRAPI_ADMIN_EMAIL    default: admin@footballke.com
 *   STRAPI_ADMIN_PASSWORD default: Admin1234!
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load .env from the footballke-cms root
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

const DATA_DIR  = resolve(__dirname, '../../footballke/data')
const BASE_URL  = process.env.STRAPI_URL            ?? 'http://localhost:3001'
const EMAIL     = process.env.STRAPI_ADMIN_EMAIL    ?? 'admin@footballke.com'
const PASSWORD  = process.env.STRAPI_ADMIN_PASSWORD ?? 'Admin1234!'

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

// Find a documentId by slug using the content-manager API (accepts admin token).
async function findBySlug(uid, slug) {
  const res = await apiGet(
    `/content-manager/collection-types/${uid}?filters[slug][$eq]=${encodeURIComponent(slug)}&pagination[pageSize]=1`
  )
  return res?.results?.[0]?.documentId ?? null
}

// ── Content converter: JSON ContentBlock[] → TipTap JSON string ──────────────

function blockToTipTap(block) {
  switch (block.type) {
    case 'paragraph':
      return {
        type: 'paragraph',
        content: [{ type: 'text', text: block.text }],
      }

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
              ...(block.attribution
                ? [{ type: 'text', text: `\n— ${block.attribution}` }]
                : []),
            ],
          },
        ],
      }

    case 'list':
      return {
        type: block.ordered ? 'orderedList' : 'bulletList',
        content: block.items.map(item => ({
          type: 'listItem',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: item }] },
          ],
        })),
      }

    case 'image':
      return {
        type: 'paragraph',
        content: [{ type: 'text', text: `[Image: ${block.alt}]` }],
      }

    default:
      return null
  }
}

function contentBlocksToTipTap(blocks) {
  const nodes = Array.isArray(blocks)
    ? blocks.map(blockToTipTap).filter(Boolean)
    : []
  return JSON.stringify({ type: 'doc', content: nodes })
}

// ── Seed functions ────────────────────────────────────────────────────────────

async function seedCategories(categories) {
  console.log('\n── Categories ──')
  const map = {}
  for (const cat of categories) {
    const existing = await findBySlug('api::category.category', cat.slug)
    if (existing) {
      console.log(`  skip  ${cat.name} (already exists)`)
      map[cat.id] = existing
      continue
    }
    const created = await cmsCreate('api::category.category', {
      name:  cat.name,
      slug:  cat.slug,
      color: cat.color,
    })
    map[cat.id] = created.documentId ?? created.data?.documentId
    console.log(`  ✓ created ${cat.name}`)
  }
  return map
}

async function seedAuthors(authors) {
  console.log('\n── Authors ──')
  const map = {}
  for (const author of authors) {
    // Authors have no slug field — find by name
    const list = await apiGet(
      `/content-manager/collection-types/api::author.author?filters[name][$eq]=${encodeURIComponent(author.name)}&pagination[pageSize]=1`
    )
    const existing = list?.results?.[0]?.documentId
    if (existing) {
      console.log(`  skip  ${author.name} (already exists)`)
      map[author.id] = existing
      continue
    }
    const created = await cmsCreate('api::author.author', {
      name: author.name,
      role: author.role,
      bio:  author.bio ?? '',
    })
    map[author.id] = created.documentId ?? created.data?.documentId
    console.log(`  ✓ created ${author.name}`)
  }
  return map
}

async function seedClubs(clubs) {
  console.log('\n── Clubs ──')
  const map = {}
  for (const club of clubs) {
    const existing = await findBySlug('api::club.club', club.slug)
    if (existing) {
      console.log(`  skip  ${club.name} (already exists)`)
      map[club.slug] = existing
      continue
    }
    const created = await cmsCreate('api::club.club', {
      name:            club.name,
      slug:            club.slug,
      shortName:       club.shortName,
      abbreviation:    club.abbreviation,
      founded:         club.founded,
      city:            club.city,
      country:         club.country ?? 'Kenya',
      primaryColor:    club.colors?.primary ?? '#000000',
      secondaryColor:  club.colors?.secondary ?? '#ffffff',
      venueName:       club.venue?.name,
      venueCity:       club.venue?.city,
      venueCapacity:   club.venue?.capacity,
      description:     club.description,
      achievements:    club.achievements ?? [],
      twitterUrl:      club.social?.twitter,
      facebookUrl:     club.social?.facebook,
      instagramUrl:    club.social?.instagram,
      websiteUrl:      club.social?.website,
    })
    map[club.slug] = created.documentId ?? created.data?.documentId
    console.log(`  ✓ created ${club.name}`)
  }
  return map
}

async function seedPlayers(players, clubMap) {
  console.log('\n── Players ──')
  for (const player of players) {
    const existing = await findBySlug('api::player.player', player.slug)
    if (existing) {
      console.log(`  skip  ${player.name}`)
      continue
    }
    const clubDocId = clubMap[player.clubSlug ?? player.clubId?.replace(/^[a-z]+-/, '')]
    const data = {
      name:             player.name,
      slug:             player.slug,
      jerseyNumber:     player.jerseyNumber,
      position:         player.position,
      secondaryPosition:player.secondaryPosition ?? undefined,
      nationalityName:  player.nationality?.name ?? 'Kenyan',
      nationalityCode:  player.nationality?.code ?? 'KE',
      nationalityFlag:  player.nationality?.flag ?? '/flags/ke.svg',
      dateOfBirth:      player.dateOfBirth,
      height:           player.height,
      preferredFoot:    player.preferredFoot,
      contractUntil:    player.contract?.until,
      contractType:     player.contract?.type ?? 'permanent',
      bio:              player.bio,
      statsAppearances: player.stats?.appearances ?? 0,
      statsGoals:       player.stats?.goals ?? 0,
      statsAssists:     player.stats?.assists ?? 0,
      statsYellowCards: player.stats?.yellowCards ?? 0,
      statsRedCards:    player.stats?.redCards ?? 0,
      statsMinutesPlayed: player.stats?.minutesPlayed ?? 0,
      statsCleanSheets: player.stats?.cleanSheets ?? 0,
      ...(clubDocId ? { club: { connect: [{ id: clubDocId }] } } : {}),
    }
    await cmsCreate('api::player.player', data)
    console.log(`  ✓ created ${player.name}`)
  }
}

async function seedArticles(articles, categoryMap, authorMap) {
  console.log('\n── Articles ──')
  for (const article of articles) {
    const existing = await findBySlug('api::article.article', article.slug)
    if (existing) {
      console.log(`  skip  ${article.title}`)
      continue
    }

    const catDocId    = categoryMap[article.categoryId ?? article.categorySlug]
      ?? await findBySlug('api::category.category', article.categorySlug)
    const authorDocId = authorMap[article.authorId]

    const content = contentBlocksToTipTap(article.content)

    const data = {
      title:        article.title,
      slug:         article.slug,
      excerpt:      article.excerpt,
      content,
      featured:     article.featured ?? false,
      relatedSlugs: article.relatedSlugs ?? [],
      publishedAt:  article.publishedAt,
      ...(catDocId    ? { category: { connect: [{ id: catDocId }] } }    : {}),
      ...(authorDocId ? { author:   { connect: [{ id: authorDocId }] } } : {}),
    }

    const created = await cmsCreate('api::article.article', data)
    const docId = created.documentId ?? created.data?.documentId

    // Publish the article (articles have draft-and-publish enabled)
    if (docId) await cmsPublish('api::article.article', docId)

    console.log(`  ✓ created + published "${article.title}"`)
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Seeding ${BASE_URL} …`)

  await login()

  const { categories, authors, articles } = loadJson('news.json')
  const { clubs }   = loadJson('clubs.json')
  const { players } = loadJson('players.json')

  const categoryMap = await seedCategories(categories)
  const authorMap   = await seedAuthors(authors)
  const clubMap     = await seedClubs(clubs)
  await seedPlayers(players, clubMap)
  await seedArticles(articles, categoryMap, authorMap)

  console.log('\n✅ Seed complete.')
}

main().catch(err => {
  console.error('\n❌ Seed failed:', err.message)
  process.exit(1)
})
