/**
 * Canvas WS Matrix
 * Stream a canvas element to a LED Matrix.
 */

// Styles
import './css/styles.scss';


class WsMatrix {
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
    this.ws = new WebSocket(`ws://${this.ip}`);
    this.ws.binaryType = 'arraybuffer';

    // WS open event
    this.ws.onopen = () => {
      // eslint-disable-next-line
      console.log('WebSocket open');
      this.wsOpen = true;
      this.status(2);

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
    // Currently not used, just logged.
    this.ws.onmessage = (evt) => {
      // eslint-disable-next-line
      console.log(`WS message: ${evt.data}`);
    };
  }

  /**
   * Status bar
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
   * If your matrix is in a zigzag serpentine layout
   * this code will order the data array being sent
   * to the matrix.
   */
  matrixMapping(p) {
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
    const scaleW = Math.floor((window.innerWidth * 0.9) / this.width);
    const scaleH = Math.floor((window.innerHeight * 0.8) / this.height);

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
    const buffer = new ArrayBuffer(this.width * this.height * 3);
    const bytearray = new Uint8Array(buffer, 0, this.width * this.height * 3);

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
    for (let i = 0; i < (this.width * this.height * 3); i += 3) {
      const p = i / 3;
      const y = Math.floor(p / this.width);
      const x = p - (y * this.width);
      const arrayPos = this.matrixMapping(p);
      let pixel;

      // Get pixel data
      if (this.type === '2d') {
        pixel = context.getImageData(x, y, 1, 1).data;
      }
      else if (this.type === 'webgl') {
        pixel = new Uint8Array(4);
        context.readPixels(x, y, 1, 1, context.RGBA, context.UNSIGNED_BYTE, pixel);
      }

      // Add pixel data to array
      bytearray[arrayPos] = pixel[0];
      bytearray[arrayPos + 1] = pixel[1];
      bytearray[arrayPos + 2] = pixel[2];
    }

    // Send data!
    this.ws.send(bytearray);
  }
}


// Export WS Matrix
const matrixClass = new WsMatrix();
window.wsMatrix = matrixClass;
