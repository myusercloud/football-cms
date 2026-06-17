'use strict'

module.exports = {
  register({ strapi }) {
    strapi.customFields.register({
      name: 'rich-body',
      plugin: 'rich-body',
      type: 'richtext',
    })

    strapi.server.router.get('/api/rich-body/search', async (ctx) => {
      const q = String(ctx.query.q ?? '').trim()
      if (q.length < 1) {
        ctx.body = []
        return
      }

      const [players, clubs] = await Promise.all([
        strapi.documents('api::player.player').findMany({
          filters: { name: { $containsi: q } },
          limit: 8,
          fields: ['name', 'slug'],
        }),
        strapi.documents('api::club.club').findMany({
          filters: { name: { $containsi: q } },
          limit: 8,
          fields: ['name', 'slug'],
        }),
      ])

      ctx.body = [
        ...players.map((p) => ({
          id:         p.slug,
          entityType: 'player',
          entitySlug: p.slug,
          entityName: p.name,
          label:      `${p.name} — player`,
          href:       `/players/${p.slug}`,
        })),
        ...clubs.map((c) => ({
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
