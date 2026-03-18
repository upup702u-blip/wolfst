function checkWinConditions(channel) {
    try {
        const mafiaCount = gameState.players.filter(
            (player) => gameState.playerRoles.get(player) === 'ذئب'
        ).length;

        const citizenCount = gameState.players.length - mafiaCount;

        let winner = null;

        if (mafiaCount === 0) {
            winner = '🎉 **القرووين فازوا!**';
        } else if (mafiaCount >= citizenCount) {
            winner = '💀 **فازت الذئاب!**';
        }

        if (winner) {
            // Determine the image and mentions based on the winner
            const imagePath = mafiaCount === 0 ? 'v.png' : 'm.png';
            const winningTeam = mafiaCount === 0 
                ? gameState.players.filter(player => gameState.playerRoles.get(player) !== 'ذئب') 
                : gameState.players.filter(player => gameState.playerRoles.get(player) === 'ذئب');
            const winningMentions = winningTeam.map(playerId => `<@${playerId}>`).join(', ');

            // Get alive players
            const alivePlayers = getAlivePlayers();

            // Send the result image
            const filePath = path.join(__dirname, imagePath);
            const attachment = new AttachmentBuilder(filePath);

            channel.send({ files: [attachment] }).then(() => {
                // Send the mentions and alive players
                channel.send(`**||@here||  ${winningMentions} 🏆**`);
            });

            resetGame();
            return true;
        }

        return false;
    } catch (error) {
        console.error('Error in checkWinConditions:', error);
        return false;
    }
}