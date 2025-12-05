import { GameModel } from '../src/models/game.model'
import { Player } from '../src/models/player.model'
import { connectDB } from '../src/core/db'

async function main() {
  await connectDB()
  
  const gameId = process.argv[2] || 'test002'
  console.log(`\n🔧 Fixing game players: ${gameId}\n`)
  
  const game = await GameModel.findOne({ code: gameId })
  
  if (!game) {
    console.log(`❌ Game not found: ${gameId}`)
    process.exit(1)
  }
  
  // Get all global players
  const globalPlayers = await Player.find({}).lean()
  const playersByCode: Record<string, any> = {}
  globalPlayers.forEach(p => {
    playersByCode[p.code] = p
  })
  
  console.log(`Found ${game.players?.length || 0} players in game`)
  console.log(`Found ${globalPlayers.length} players in global collection\n`)
  
  // Update game players with correct names from global players
  let updated = false
  if (game.players && game.players.length > 0) {
    game.players.forEach((gamePlayer: any, i: number) => {
      const globalPlayer = playersByCode[gamePlayer.code]
      
      if (globalPlayer && gamePlayer.name !== globalPlayer.name) {
        console.log(`Updating player ${i + 1}:`)
        console.log(`  Code: ${gamePlayer.code}`)
        console.log(`  Old name: ${gamePlayer.name}`)
        console.log(`  New name: ${globalPlayer.name}`)
        
        gamePlayer.name = globalPlayer.name
        gamePlayer.playerId = globalPlayer._id.toString()
        updated = true
      }
    })
  }
  
  if (updated) {
    await game.save()
    console.log(`\n✅ Game players updated successfully!`)
  } else {
    console.log(`\n⏭️  No updates needed - all player names are correct`)
  }
  
  process.exit(0)
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
