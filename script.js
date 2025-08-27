window.addEventListener('load', () => {
    const canvas = document.getElementById('drawing-board');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const toolbar = document.querySelector('.toolbar');

    // Estado da ferramenta
    let isDrawing = false;
    let currentTool = 'pen';
    let penColor = '#1a1a1a';
    let penWidth = 3;
    let startX, startY;
    let snapshot; // Para guardar o estado do canvas antes de desenhar formas

    // Histórico para Undo/Redo
    let history = [];
    let historyIndex = -1;

    // --- CONFIGURAÇÃO INICIAL DA FOLHA ---
    const params = new URLSearchParams(window.location.search);
    const sheetStyle = params.get('style') || 'grid';
    const bgColor = '#' + (params.get('bgColor') || 'fcfcfc');
    const lineColor = '#' + (params.get('lineColor') || 'e0e0e0');

    function setCanvasSize() {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        drawBackground();
        saveState(); // Salva o estado inicial limpo
    }

    function drawBackground(context = ctx) {
        context.fillStyle = bgColor;
        context.fillRect(0, 0, context.canvas.width, context.canvas.height);

        if (sheetStyle === 'blank') return;

        context.strokeStyle = lineColor;
        context.lineWidth = 1;
        context.setLineDash([]); // Garante que as linhas não sejam pontilhadas
        const spacing = 20;
        
        context.beginPath(); // Começa um novo caminho para as linhas/pontos

        if (sheetStyle === 'grid') {
            for (let x = spacing; x < context.canvas.width; x += spacing) {
                context.moveTo(x, 0);
                context.lineTo(x, context.canvas.height);
            }
            for (let y = spacing; y < context.canvas.height; y += spacing) {
                context.moveTo(0, y);
                context.lineTo(context.canvas.width, y);
            }
            context.stroke();
        } else if (sheetStyle === 'dotted') {
            context.fillStyle = lineColor;
            for (let x = spacing; x < context.canvas.width; x += spacing) {
                for (let y = spacing; y < context.canvas.height; y += spacing) {
                    context.fillRect(x - 0.5, y - 0.5, 1, 1);
                }
            }
        } else if (sheetStyle === 'lined') {
            for (let y = spacing; y < context.canvas.height; y += spacing) {
                context.moveTo(0, y);
                context.lineTo(context.canvas.width, y);
            }
            context.stroke();
        }
    }
    
    // --- LÓGICA DE DESENHO ---
    const getMousePos = (e) => {
        const rect = canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    };

    const startDrawing = (e) => {
        isDrawing = true;
        const { x, y } = getMousePos(e);
        startX = x;
        startY = y;
        ctx.beginPath(); // Inicia um novo caminho
        ctx.moveTo(x, y);
        // Tira uma "foto" do canvas antes de começar a desenhar formas
        snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    };

    const drawing = (e) => {
        if (!isDrawing) return;
        const { x, y } = getMousePos(e);

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (currentTool === 'pen' || currentTool === 'eraser') {
            ctx.globalCompositeOperation = currentTool === 'eraser' ? 'destination-out' : 'source-over';
            ctx.strokeStyle = penColor;
            ctx.lineWidth = penWidth;
            ctx.lineTo(x, y);
            ctx.stroke();
        } else {
            // Restaura a "foto" para desenhar a pré-visualização da forma
            ctx.putImageData(snapshot, 0, 0);
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = penColor;
            ctx.lineWidth = penWidth;

            // Começa um novo caminho para a forma
            ctx.beginPath();
            switch (currentTool) {
                case 'line':
                    ctx.moveTo(startX, startY);
                    ctx.lineTo(x, y);
                    break;
                case 'rect':
                    ctx.rect(startX, startY, x - startX, y - startY);
                    break;
                case 'circle':
                    const radius = Math.sqrt(Math.pow(x - startX, 2) + Math.pow(y - startY, 2));
                    ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
                    break;
            }
            ctx.stroke();
        }
    };

    const stopDrawing = () => {
        if (!isDrawing) return;
        isDrawing = false;
        ctx.closePath();
        saveState();
    };
    
    // --- CONTROLES DA TOOLBAR ---
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelector('.tool-btn.active').classList.remove('active');
            btn.classList.add('active');
            currentTool = btn.id;
        });
    });

    document.getElementById('penColor').addEventListener('input', (e) => penColor = e.target.value);
    document.getElementById('penWidth').addEventListener('input', (e) => penWidth = e.target.value);
    
    // --- AÇÕES (SALVAR, LIMPAR, HISTÓRICO) ---
    const saveButton = document.getElementById('save');
    saveButton.addEventListener('click', () => {
        const link = document.createElement('a');
        link.download = 'notes-board.png';
        
        // Cria um canvas temporário para unir o fundo e o desenho
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // 1. Desenha o fundo (com linhas, pontos, etc.) no canvas temporário
        drawBackground(tempCtx);
        // 2. Desenha o canvas principal (com os rabiscos) por cima
        tempCtx.drawImage(canvas, 0, 0);
        
        link.href = tempCanvas.toDataURL('image/png');
        link.click();
    });

    document.getElementById('clear').addEventListener('click', () => {
        drawBackground();
        saveState();
    });

    function saveState() {
        if (historyIndex < history.length - 1) {
            history.splice(historyIndex + 1);
        }
        history.push(canvas.toDataURL());
        historyIndex = history.length - 1;
        updateHistoryButtons();
    }

    function restoreState(index) {
        const img = new Image();
        img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
        };
        img.src = history[index];
    }
    
    document.getElementById('undo').addEventListener('click', () => {
        if (historyIndex > 0) {
            historyIndex--;
            restoreState(historyIndex);
            updateHistoryButtons();
        }
    });

    document.getElementById('redo').addEventListener('click', () => {
        if (historyIndex < history.length - 1) {
            historyIndex++;
            restoreState(historyIndex);
            updateHistoryButtons();
        }
    });
    
    function updateHistoryButtons() {
        document.getElementById('undo').disabled = historyIndex <= 0;
        document.getElementById('redo').disabled = historyIndex >= history.length - 1;
    }

    // --- INICIALIZAÇÃO ---
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', drawing);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', () => { if (isDrawing) stopDrawing(); });
    
    window.addEventListener('resize', setCanvasSize);
    setCanvasSize();
});
