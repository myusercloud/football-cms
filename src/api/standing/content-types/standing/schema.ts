export default {
  kind: 'collectionType',
  collectionName: 'standings',
  info: {
    singularName: 'standing',
    pluralName: 'standings',
    displayName: 'Standing',
  },
  options: { draftAndPublish: false },
  pluginOptions: {},
  attributes: {
    competitionId: { type: 'string', required: true },
    competitionName: { type: 'string', required: true },
    competitionSlug: { type: 'string', required: true },
    competitionLogo: { type: 'string', required: true },
    competitionCountry: { type: 'string', required: true },
    seasonId: { type: 'string', required: true },
    seasonLabel: { type: 'string', required: true },
    zones: { type: 'json' },
    rows: { type: 'json', required: true },
  },
}
