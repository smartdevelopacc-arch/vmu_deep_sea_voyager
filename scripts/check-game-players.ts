import { GameModel } from '../src/models/game.model'
import { Player } from '../src/models/player.model'
import { connectDB } from '../src/core/db'

async function main() {
  await connectDB()
  
  const gameId = process.argv[2] || 'test002'
  console.log(`\n📋 Checking game: ${gameId}\n`)
  
  const game = await GameModel.findOne({ code: gameId }).lean()
  
  if (!game) {
    console.log(`❌ Game not found: ${gameId}`)
    process.exit(1)
  }
  
  console.log(`✅ Found game: ${game.code}`)
  console.log(`📊 Game has ${game.players?.length || 0} players\n`)
  
  if (game.players && game.players.length > 0) {
    console.log('Players in game:')
    console.log('================')
    game.players.forEach((p: any, i: number) => {
      console.log(`\n${i + 1}. Player:`)
      console.log(`   Code: ${p.code}`)
      console.log(`   Name: ${p.name || '(empty)'}`)
      console.log(`   PlayerId: ${p.playerId || '(none)'}`)
      console.log(`   Score: ${p.score}`)
      console.log(`   Energy: ${p.energy}`)
      console.log(`   Position: (${p.position?.x}, ${p.position?.y})`)
    })
  }
  
  // Also check global players table
  console.log('\n\n🌍 Checking global Players collection:')
  console.log('=====================================')
  const globalPlayers = await Player.find({}).lean()
  console.log(`Total players in database: ${globalPlayers.length}\n`)
  
  globalPlayers.forEach((p: any) => {
    console.log(`Code: ${p.code} | Name: ${p.name || '(empty)'} | _id: ${p._id}`)
  })
  
  process.exit(0)
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
