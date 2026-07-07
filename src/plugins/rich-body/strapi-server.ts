import type { Core } from '@strapi/strapi'

export default {
  register({ strapi }: { strapi: Core.Strapi }) {
    strapi.customFields.register({
      name: 'rich-body',
      plugin: 'rich-body',
      type: 'richtext',
    })

    // Search route — no auth required; returns player + club matches for a query string
    strapi.server.router.get('/api/rich-body/search', async (ctx) => {
      const q = String(ctx.query.q ?? '').trim()
      if (q.length < 1) {
        ctx.body = []
        return
      }

      let players: any[], clubs: any[]
      try {
        ;[players, clubs] = await Promise.all([
          strapi.documents('api::player.player').findMany({
            filters: { name: { $containsi: q } } as any,
            limit: 8,
            fields: ['name', 'slug'],
          }),
          strapi.documents('api::club.club').findMany({
            filters: { name: { $containsi: q } } as any,
            limit: 8,
            fields: ['name', 'slug'],
          }),
        ])
      } catch {
        ctx.status = 500
        ctx.body = { error: 'Search failed' }
        return
      }

      ctx.body = [
        ...players.map((p: any) => ({
          id:         p.slug,
          entityType: 'player',
          entitySlug: p.slug,
          entityName: p.name,
          label:      `${p.name} — player`,
          href:       `/players/${p.slug}`,
        })),
        ...clubs.map((c: any) => ({
          id:         c.slug,
          entityType: 'club',
          entitySlug: c.slug,
          entityName: c.name,
          label:      `${c.name} — club`,
          href:       `/clubs/${c.slug}`,
        })),
      ]
    })
  },

  bootstrap() {},
}
