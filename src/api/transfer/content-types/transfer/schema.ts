export default {
  kind: 'collectionType',
  collectionName: 'transfers',
  info: {
    singularName: 'transfer',
    pluralName: 'transfers',
    displayName: 'Transfer',
    description: 'Player transfer records and rumours',
  },
  options: { draftAndPublish: false },
  pluginOptions: {},
  attributes: {
    player: {
      type: 'relation',
      relation: 'manyToOne',
      target: 'api::player.player',
    },
    fromClub: {
      type: 'relation',
      relation: 'manyToOne',
      target: 'api::club.club',
    },
    toClub: {
      type: 'relation',
      relation: 'manyToOne',
      target: 'api::club.club',
    },
    fee:               { type: 'string' },
    transferStatus: {
      type: 'enumeration',
      enum: ['confirmed', 'loan', 'rumour', 'exit'],
      required: true,
    },
    confidence: {
      type: 'enumeration',
      enum: ['hot', 'warm', 'cool'],
    },
    window:            { type: 'string', required: true },
    transferDate:      { type: 'date', required: true },
    sourceLabel:       { type: 'string' },
    linkedArticleSlug: { type: 'string' },
  },
}
