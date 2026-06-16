export default {
  register(/* { strapi } */) {},

  async bootstrap({ strapi }: { strapi: any }) {
    // Grant the Public role find/findOne access to all API content types.
    // This runs every startup — it is idempotent (setting an already-granted
    // permission is a no-op) so it is safe to leave in place permanently.
    const publicRole = await strapi
      .query('plugin::users-permissions.role')
      .findOne({ where: { type: 'public' } })

    if (!publicRole) return

    const contentTypes = [
      'api::article.article',
      'api::author.author',
      'api::category.category',
      'api::club.club',
      'api::fixture.fixture',
      'api::player.player',
      'api::standing.standing',
      'api::tournament.tournament',
      'api::transfer.transfer',
    ]

    const existingPermissions: { action: string }[] = await strapi
      .query('plugin::users-permissions.permission')
      .findMany({ where: { role: publicRole.id } })

    const existing = new Set(existingPermissions.map((p) => p.action))

    const toCreate: { action: string; role: number }[] = []
    for (const uid of contentTypes) {
      const shortName = uid.split('.')[1]
      const findAction   = `api::${shortName}.${shortName}.find`
      const findOneAction = `api::${shortName}.${shortName}.findOne`
      if (!existing.has(findAction))    toCreate.push({ action: findAction,    role: publicRole.id })
      if (!existing.has(findOneAction)) toCreate.push({ action: findOneAction, role: publicRole.id })
    }

    if (toCreate.length) {
      await Promise.all(
        toCreate.map((p) =>
          strapi.query('plugin::users-permissions.permission').create({ data: p })
        )
      )
      strapi.log.info(`[bootstrap] Granted public read access to ${toCreate.length} actions`)
    }
  },
}
