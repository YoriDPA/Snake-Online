<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Snake Online - por Yoridpa</title>
    <style>
        body {
            display: flex;
            flex-direction: column;
            align-items: center;
            font-family: Arial, sans-serif;
            background-color: #f0f0f0;
            margin: 0;
            height: 100vh;
        }
        canvas {
            border: 2px solid #000000;
            background-color: #e0e0e0;
            max-width: 90vw; /* Limite de 90% da largura da viewport */
            max-height: 90vh; /* Limite de 90% da altura da viewport */
        }
        #score {
            font-size: 24px;
            margin: 10px 0;
            color: #333333;
        }
        #fullscreen-btn {
            margin: 10px 0;
            padding: 10px 20px;
            font-size: 16px;
            cursor: pointer;
        }
    </style>
</head>
<body>
    <div id="score">Pontuação: 0</div>
    <canvas id="gameCanvas"></canvas>
    <button id="fullscreen-btn">Tela Cheia</button>
    <script>
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        const scoreDisplay = document.getElementById('score');
        const fullscreenBtn = document.getElementById('fullscreen-btn');

        // Ajuste dinâmico do tamanho do canvas
        function resizeCanvas() {
            const size = Math.min(window.innerWidth * 0.9, window.innerHeight * 0.9); // 90% da menor dimensão
            canvas.width = size;
            canvas.height = size;
            tileCount = Math.floor(canvas.width / gridSize);
        }

        window.addEventListener('resize', resizeCanvas);
        resizeCanvas(); // Chama ao carregar

        const gridSize = 20;
        let tileCount = Math.floor(canvas.width / gridSize);
        let snake = [{ x: Math.floor(tileCount / 2), y: Math.floor(tileCount / 2) }]; // Centraliza a cobra
        let food = { x: 15, y: 15 };
        let dx = 0;
        let dy = 0;
        let score = 0;
        let gameLoop;

        document.addEventListener('keydown', (e) => {
            switch (e.key) {
                case 'ArrowUp':
                    if (dy !== 1) { dx = 0; dy = -1; }
                    break;
                case 'ArrowDown':
                    if (dy !== -1) { dx = 0; dy = 1; }
                    break;
                case 'ArrowLeft':
                    if (dx !== 1) { dx = -1; dy = 0; }
                    break;
                case 'ArrowRight':
                    if (dx !== -1) { dx = 1; dy = 0; }
                    break;
            }
        });

        // Tela cheia
        fullscreenBtn.addEventListener('click', () => {
            if (canvas.requestFullscreen) {
                canvas.requestFullscreen();
            } else if (canvas.webkitRequestFullscreen) { // Compatibilidade com Safari
                canvas.webkitRequestFullscreen();
            } else if (canvas.msRequestFullscreen) { // Compatibilidade com IE/Edge
                canvas.msRequestFullscreen();
            }
            resizeCanvas(); // Ajusta o tamanho após entrar em tela cheia
        });

        function game() {
            const head = { x: snake[0].x + dx, y: snake[0].y + dy };
            snake.unshift(head);

            if (head.x === food.x && head.y === food.y) {
                score += 1;
                scoreDisplay.textContent = `Pontuação: ${score}`;
                generateFood();
            } else {
                snake.pop();
            }

            if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount) {
                gameOver();
                return;
            }

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Desenhar a cobra com gradiente
            const gradient = ctx.createLinearGradient(0, 0, 0, gridSize);
            gradient.addColorStop(0, '#27ae60'); // Verde escuro na cabeça
            gradient.addColorStop(1, '#2ecc71'); // Verde claro na cauda
            ctx.fillStyle = gradient;
            snake.forEach(segment => {
                ctx.fillRect(segment.x * gridSize, segment.y * gridSize, gridSize - 2, gridSize - 2);
            });

            // Desenhar a comida em laranja
            ctx.fillStyle = '#e67e22'; // Laranja vibrante
            ctx.fillRect(food.x * gridSize, food.y * gridSize, gridSize - 2, gridSize - 2);
        }

        function generateFood() {
            food.x = Math.floor(Math.random() * tileCount);
            food.y = Math.floor(Math.random() * tileCount);
            for (let segment of snake) {
                if (food.x === segment.x && food.y === segment.y) {
                    generateFood();
                }
            }
        }

        function gameOver() {
            clearInterval(gameLoop);
            alert(`Fim de jogo! Sua pontuação: ${score}`);
            snake = [{ x: Math.floor(tileCount / 2), y: Math.floor(tileCount / 2) }]; // Reinicia no centro
            food = { x: 15, y: 15 };
            dx = 0;
            dy = 0;
            score = 0;
            scoreDisplay.textContent = `Pontuação: ${score}`;
            gameLoop = setInterval(game, 150);
        }

        gameLoop = setInterval(game, 150);
    </script>
</body>
</html>
