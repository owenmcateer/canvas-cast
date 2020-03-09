/**
 * Canvas Cast
 * Cast any <canvas> element to an LED Matrix
 * over WebSockets with an Arduino/ESP8266.
 */

// Styles
import './css/styles.scss';


class CanvasCast {
  /**
   * Init()
   * @param {Obj} settings
   */
  init(settings) {
    this.ip = settings.ip;
    this.width = settings.width;
    this.height = settings.height;
    this.brightness = settings.brightness;
    this.type = settings.type;
    this.customMap = settings.customMap || false;

    this.stageResized = false;
    this.wsOpen = false;
    this.ws = false;

    // Connect WS
    this.connect();

    // Everything UI
    this.ui();
  }

  /**
   * Connect to WS deivce
   */
  connect() {
    // Open WebSocket connection
    this.status(1);
    this.ws = new WebSocket(`ws://${this.ip}/`);
    this.ws.binaryType = 'arraybuffer';

    // WS open event
    this.ws.onopen = () => {
      // eslint-disable-next-line
      console.log('WebSocket open');
      this.wsOpen = true;
      this.status(1);

      // Set default brightness
      this.uiBrightness();
    };

    // WS closed event
    this.ws.onclose = () => {
      // eslint-disable-next-line
      console.log('WebSocket close');
      this.wsOpen = false;
      this.status(0);
    };

    // WS error event
    this.ws.onerror = (evt) => {
      // eslint-disable-next-line
      console.log(evt);
      this.status(3);
    };

    // WS message received
    this.ws.onmessage = (evt) => {
      switch (evt.data) {
        case 'Connected':
          this.status(2);
          break;

        case 'Busy':
          this.ws.close();
          setTimeout(() => this.status(4), 250);
          break;

        default:
          // eslint-disable-next-line
          console.log(`WS message: ${evt.data}`);
      }
    };

    // Close connection on page exit.
    window.addEventListener('unload', e => {
      this.ws.close();
    });
  }

  /**
   * Status bar
   * @param {Int} statusId Statis ID number
   */
  status(statusId) {
    const open = this.ws;
    const elemStatus = document.querySelector('.wsBar .status');
    const elemStatusTxt = document.querySelector('.wsBar .statusTxt');

    switch (statusId) {
      case 0:
        elemStatus.dataset.status = 'closed';
        elemStatusTxt.innerHTML = 'closed';
        break;

      case 1:
        elemStatus.dataset.status = 'connecting';
        elemStatusTxt.innerHTML = 'connecting...';
        break;

      case 2:
        elemStatus.dataset.status = 'open';
        elemStatusTxt.innerHTML = 'connected';
        break;

      case 3:
        elemStatus.dataset.status = 'error';
        elemStatusTxt.innerHTML = 'error connecting';
        break;

      case 4:
        elemStatus.dataset.status = 'busy';
        elemStatusTxt.innerHTML = 'too many connected';
        break;

      default:
    }
  }


  /**
   * UI
   */
  ui() {
    /**
     * Brightness control
     */
    const brightness = document.getElementById('matrix-brightness');
    // Set UI default
    brightness.value = this.brightness;
    // Brightness controller
    brightness.addEventListener('input', () => {
      this.uiBrightness();
    });

    /**
     * IP address
     */
    const elemStatusIp = document.querySelector('.wsBar .statusIP');
    elemStatusIp.innerText = this.ip;

    /**
     * On resize
     */
    window.addEventListener('resize', () => {
      this.stageResized = false;
    }, false);
  }

  /**
   * Change brightness of Matrix
   */
  uiBrightness() {
    const brightness = document.getElementById('matrix-brightness');
    if (this.wsOpen) {
      this.brightness = brightness.value;
      this.ws.send(`BRIGHTNESS:${this.brightness}`);
    }
  }


  /**
   * Matrix Serpentine Layout
   *
   * If your matrix is in a zigzag serpentine layout
   * this code will order the data array being sent
   * to the matrix.
   *
   * @param  {Int} p Pixel position in canvas
   * @return {Int} Position in Matrix
   */
  matrixSerpentine(p) {
    let position;

    // Odd rows get reversed
    const y = Math.floor(p / this.width);
    const x = p - (this.width * y);
    if (y & 0x01) {
      const reverseX = (this.width - 1) - x;
      position = ((y * this.width) + reverseX) * 3;
    }
    else {
      position = p * 3;
    }
    return position;
  }


  /**
   * Resize stage in browser for usability.
   * @param {DOM Canvas} canvas
   */
  resizeStage(canvas) {
    // Get W/H scaling
    const scaleW = (window.innerWidth * 0.9) / this.width;
    const scaleH = (window.innerHeight * 0.8) / this.height;

    // Which size to scale by?
    const scale = (scaleH < scaleW) ? scaleH : scaleW;
    const newWidth = this.width * scale;
    const newHeight = this.width * scale;

    // Update stage canvas size
    canvas.style.width = `${newWidth}px`;
    canvas.style.height = `${newHeight}px`;

    // Mark as resized
    this.stageResized = true;
  }


  /**
   * Cast canvas to matrix.
   * @param {DOM Canvas} canvas
   */
  cast(canvas) {
    // Resized?
    if (!this.stageResized) {
      this.resizeStage(canvas);
    }

    // Is WS open?
    if (!this.wsOpen) {
      return;
    }

    // Create 8 bit array buffer
    const buffer = new ArrayBuffer(this.getBufferSize());
    const bytearray = new Uint8Array(buffer, 0, this.getBufferSize());

    // 2D or WebGL
    let context;
    if (this.type === '2d') {
      context = canvas.getContext('2d');
    }
    else if (this.type === 'webgl') {
      context = canvas.getContext('webgl', {
        antialias: false,
        depth: false,
      });
    }

    // Build and order data array
    for (let i = 0; i < (this.getBufferSize()); i += 3) {
      const p = i / 3;

      // Get canvas mapping info
      const canvasData = this.canvasMapping(p);
      let pixel;

      // Get pixel data
      if (this.type === '2d') {
        pixel = context.getImageData(canvasData.x, canvasData.y, 1, 1).data;
      }
      else if (this.type === 'webgl') {
        pixel = new Uint8Array(4);
        context.readPixels(canvasData.x, canvasData.y, 1, 1, context.RGBA, context.UNSIGNED_BYTE, pixel);
      }

      // Add pixel data to array
      bytearray[canvasData.position] = pixel[0];
      bytearray[canvasData.position + 1] = pixel[1];
      bytearray[canvasData.position + 2] = pixel[2];
    }

    // Send data!
    this.ws.send(bytearray);
  }

  /**
   * Render pixel guidelines for custom matrix
   * @param {DOM Canvas} canvas DOM Canvas
   * @param {Int} size Pixel size of guide pixel
   */
  guide(canvas, size) {
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return;
    }

    // Draw the pixel map guide
    for (var i = 0; i < this.customMap.length; i++) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'black';

      ctx.beginPath();
      ctx.ellipse(this.customMap[i].x, this.customMap[i].y, size, size, Math.PI / 4, 0, 2 * Math.PI);
      ctx.stroke();

      ctx.strokeStyle = 'white';
      ctx.beginPath();
      ctx.ellipse(this.customMap[i].x, this.customMap[i].y, size - 1, size - 1, Math.PI / 4, 0, 2 * Math.PI);
      ctx.stroke();
    }
  }

  /**
   * Returns require graphic buffer size
   * @return {Int} Graphic buffer size
   */
  getBufferSize() {
    if (this.customMap) {
      return this.customMap.length * 3;
    }

    // Else return default matrix
    return this.width * this.height * 3
  }

  /**
   * Maps canvas position to Matrix position
   * @return {Obj} {x, y, position}
   */
  canvasMapping(pixel) {
    // Custom pixel mapping
    if (this.customMap) {
      return {
        y: this.customMap[pixel].y,
        x: this.customMap[pixel].x,
        position: pixel * 3,
      };
    }

    // Standard matrix
    const y = Math.floor(pixel / this.width);
    return {
      y,
      x: pixel - (y * this.width),
      position: this.matrixSerpentine(pixel),
    };
  }
}


// Export WS Matrix
const matrixClass = new CanvasCast();
window.canvasCast = matrixClass;
