export default {
  kind: 'collectionType',
  collectionName: 'categories',
  info: {
    singularName: 'category',
    pluralName: 'categories',
    displayName: 'Category',
  },
  options: { draftAndPublish: false },
  pluginOptions: {},
  attributes: {
    name: { type: 'string', required: true },
    slug: { type: 'uid', targetField: 'name', required: true },
    color: {
      type: 'enumeration',
      enum: ['emerald', 'amber', 'blue', 'purple', 'red', 'lime', 'zinc'],
      default: 'zinc',
      required: true,
    },
    articles: {
      type: 'relation',
      relation: 'oneToMany',
      target: 'api::article.article',
      mappedBy: 'category',
    },
  },
}
