export default {
  kind: 'collectionType',
  collectionName: 'articles',
  info: {
    singularName: 'article',
    pluralName: 'articles',
    displayName: 'Article',
    description: 'News articles and match reports',
  },
  options: { draftAndPublish: false },
  pluginOptions: {},
  attributes: {
    title: { type: 'string', required: true },
    slug: { type: 'uid', targetField: 'title', required: true },
    excerpt: { type: 'text', required: true },
    content: { type: 'richtext' },
    coverImage: { type: 'media', multiple: false, required: false, allowedTypes: ['images'] },
    featured: { type: 'boolean', default: false },
    author: {
      type: 'relation',
      relation: 'manyToOne',
      target: 'api::author.author',
      inversedBy: 'articles',
    },
    category: {
      type: 'relation',
      relation: 'manyToOne',
      target: 'api::category.category',
      inversedBy: 'articles',
    },
  },
}
