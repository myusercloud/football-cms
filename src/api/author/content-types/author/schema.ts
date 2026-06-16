export default {
  kind: 'collectionType',
  collectionName: 'authors',
  info: {
    singularName: 'author',
    pluralName: 'authors',
    displayName: 'Author',
  },
  options: { draftAndPublish: false },
  pluginOptions: {},
  attributes: {
    name: { type: 'string', required: true },
    role: { type: 'string', required: true },
    bio: { type: 'text' },
    avatar: { type: 'media', multiple: false, allowedTypes: ['images'] },
    articles: {
      type: 'relation',
      relation: 'oneToMany',
      target: 'api::article.article',
      mappedBy: 'author',
    },
  },
}
