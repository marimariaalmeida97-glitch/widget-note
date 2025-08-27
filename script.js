window.addEventListener('load', () => {
    const canvas = document.getElementById('drawing-board');
    if (!canvas) return; // Só executa o código do widget na página certa

    const ctx = canvas.getContext('2d');
    const toolbar = document.querySelector('.toolbar');

    // Estado da ferramenta
    let isDrawing = false;
    let currentTool = 'pen';
    let penColor = '#1a1a1a';
    let penWidth = 3;
    letstartX, startY;

    // Histórico para Undo/Redo
    let history = [];
    let historyIndex = -1;

    // --- CONFIGURAÇÃO INICIAL DA FOLHA ---
    const params = new URLSearchParams(window.location.search);
    const sheetStyle = params.get('style') || 'grid';
    const bgColor = '#' + (params.get('bgColor') || 'fcfcfc');
    const lineColor = '#' + (params.get('lineColor') || 'e0e0e0');

    document.body.style.backgroundColor = bgColor;
    canvas.style.backgroundColor = bgColor;

    function setCanvasSize() {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        drawBackground();
        redrawCanvas();
    }

    function drawBackground() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (sheetStyle === 'blank') return;

        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 1;
        const spacing = 20;

        if (sheetStyle === 'grid' || sheetStyle === 'dotted') {
            for (let x = 0; x < canvas.width; x += spacing) {
                for (let y = 0; y < canvas.height; y += spacing) {
                    if (sheetStyle === 'grid') {
                        ctx.strokeRect(x, y, spacing, spacing);
                    } else { // dotted
                        ctx.beginPath();
                        ctx.arc(x, y, 1, 0, Math.PI * 2);
                        ctx.fillStyle = lineColor;
                        ctx.fill();
                    }
                }
            }
        } else if (sheetStyle === 'lined') {
            for (let y = spacing; y < canvas.height; y += spacing) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(canvas.width, y);
                ctx.stroke();
            }
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

    const startPosition = (e) => {
        isDrawing = true;
        const { x, y } = getMousePos(e);
        startX = x;
        startY = y;
        ctx.beginPath();
        ctx.moveTo(x, y);
        if (currentTool !== 'pen' && currentTool !== 'eraser') {
            saveState(); // Salva o estado antes de começar a desenhar a forma
        }
    };

    const draw = (e) => {
        if (!isDrawing) return;
        const { x, y } = getMousePos(e);

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        if (currentTool === 'pen' || currentTool === 'eraser') {
            ctx.globalCompositeOperation = currentTool === 'eraser' ? 'destination-out' : 'source-over';
            ctx.strokeStyle = currentTool === 'eraser' ? 'rgba(0,0,0,1)' : penColor;
            ctx.lineWidth = penWidth;
            ctx.lineTo(x, y);
            ctx.stroke();
        } else {
            // Desenho de formas
            redrawCanvas(); // Restaura o canvas antes de desenhar a prévia da forma
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = penColor;
            ctx.lineWidth = penWidth;
            
            switch (currentTool) {
                case 'line':
                    ctx.beginPath();
                    ctx.moveTo(startX, startY);
                    ctx.lineTo(x, y);
                    ctx.stroke();
                    break;
                case 'rect':
                    ctx.strokeRect(startX, startY, x - startX, y - startY);
                    break;
                case 'circle':
                    const radius = Math.sqrt(Math.pow(x - startX, 2) + Math.pow(y - startY, 2));
                    ctx.beginPath();
                    ctx.arc(startX, startY, radius, 0, Math.PI * 2);
                    ctx.stroke();
                    break;
            }
        }
    };

    const endPosition = (e) => {
        if (!isDrawing) return;
         if (currentTool === 'pen' || currentTool === 'eraser') {
            ctx.closePath();
         } else {
            draw(e); // Finaliza o desenho da forma
         }
        isDrawing = false;
        saveState();
    };
    
    // --- CONTROLES DA TOOLBAR ---
    toolbar.addEventListener('click', (e) => {
        const target = e.target.closest('.tool-btn');
        if (target) {
            document.querySelector('.tool-btn.active').classList.remove('active');
            target.classList.add('active');
            currentTool = target.id;
        }
    });

    const penColorPicker = document.getElementById('penColor');
    penColorPicker.addEventListener('input', (e) => penColor = e.target.value);

    const penWidthSlider = document.getElementById('penWidth');
    penWidthSlider.addEventListener('input', (e) => penWidth = e.target.value);
    
    // --- AÇÕES (SALVAR, LIMPAR, HISTÓRICO) ---
    const saveButton = document.getElementById('save');
    saveButton.addEventListener('click', () => {
        const link = document.createElement('a');
        link.download = 'notes-board.png';
        // Salva com o fundo, criando um canvas temporário
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        drawBackgroundToContext(tempCtx);
        tempCtx.drawImage(canvas, 0, 0);
        
        link.href = tempCanvas.toDataURL('image/png');
        link.click();
    });

    const clearButton = document.getElementById('clear');
    clearButton.addEventListener('click', () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawBackground();
        saveState();
    });

    const undoButton = document.getElementById('undo');
    const redoButton = document.getElementById('redo');

    function saveState() {
        if (historyIndex < history.length - 1) {
            history = history.slice(0, historyIndex + 1);
        }
        history.push(canvas.toDataURL());
        historyIndex++;
        updateHistoryButtons();
    }

    function redrawCanvas() {
        if (history.length > 0 && historyIndex >= 0) {
            const lastImage = new Image();
            lastImage.src = history[historyIndex];
            lastImage.onload = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                drawBackground();
                ctx.drawImage(lastImage, 0, 0);
            };
        } else {
            drawBackground();
        }
    }
    
    function drawBackgroundToContext(context) { // Função auxiliar para salvar com fundo
        context.fillStyle = bgColor;
        context.fillRect(0, 0, canvas.width, canvas.height);
        if (sheetStyle === 'blank') return;
        // Re-desenha linhas (simplificado)
    }

    undoButton.addEventListener('click', () => {
        if (historyIndex > 0) {
            historyIndex--;
            const img = new Image();
            img.src = history[historyIndex];
            img.onload = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                drawBackground();
                ctx.drawImage(img, 0, 0);
            };
        } else if (historyIndex === 0) { // Volta ao estado inicial (em branco)
             historyIndex--;
             ctx.clearRect(0, 0, canvas.width, canvas.height);
             drawBackground();
        }
        updateHistoryButtons();
    });

    redoButton.addEventListener('click', () => {
        if (historyIndex < history.length - 1) {
            historyIndex++;
            const img = new Image();
            img.src = history[historyIndex];
            img.onload = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                drawBackground();
                ctx.drawImage(img, 0, 0);
            };
        }
        updateHistoryButtons();
    });
    
    function updateHistoryButtons() {
        undoButton.disabled = historyIndex <= -1;
        redoButton.disabled = historyIndex >= history.length - 1;
    }

    // --- INICIALIZAÇÃO ---
    canvas.addEventListener('mousedown', startPosition);
    canvas.addEventListener('mouseup', endPosition);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseleave', () => { isDrawing = false; }); // Evita bugs
    
    window.addEventListener('resize', setCanvasSize);
    
    setCanvasSize();
    saveState(); // Salva o estado inicial
});