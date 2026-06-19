export default {
  async beforeCreate(event: { params: { data: any } }) {
    await autoSetFromClub(event.params.data)
  },

  async beforeUpdate(event: { params: { data: any } }) {
    const { data } = event.params
    if (data.player) await autoSetFromClub(data)
  },
}

// If fromClub is not explicitly provided, look up the player's current club
// and set it automatically.
async function autoSetFromClub(data: any) {
  if (!data.player || data.fromClub) return

  // Strapi admin sends relations as { connect: [{ documentId }] }
  // Direct REST may send a documentId string
  let playerDocId: string | undefined
  if (typeof data.player === 'string') {
    playerDocId = data.player
  } else if (Array.isArray(data.player?.connect) && data.player.connect[0]?.documentId) {
    playerDocId = data.player.connect[0].documentId
  }

  if (!playerDocId) return

  const player = await (strapi as any).documents('api::player.player').findOne({
    documentId: playerDocId,
    populate: ['club'],
  })

  if (player?.club?.documentId) {
    data.fromClub = { connect: [{ documentId: player.club.documentId }] }
  }
}
