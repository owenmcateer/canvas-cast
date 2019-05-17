// Wifi SSID and password
const char* ssid = "";
const char* password = "";

// Matrix size
const uint8_t kMatrixWidth = 16;
const uint8_t kMatrixHeight = 16;

// This can be used as a safety feature (0-255)
const int maxBrightness = 127;

// Matrix settings
// See FastLED for more info: https://github.com/FastLED/FastLED/wiki/Overview
#define LED_PIN 4
#define COLOR_ORDER GRB
#define CHIPSET WS2812B
#define BRIGHTNESS 127
// End config


// Wifi and WebSockets
#include <WiFi.h>
#include <WebSocketsServer.h>
WebSocketsServer webSocket = WebSocketsServer(81);


// Matrix
#include <FastLED.h>

#if defined(FASTLED_VERSION) && (FASTLED_VERSION < 3001008)
#warning "Requires FastLED 3.1.8 or later; check github for latest code."
#endif

#define NUM_LEDS (kMatrixWidth * kMatrixHeight)
CRGB leds_plus_safety_pixel[NUM_LEDS + 1];
CRGB* const leds(leds_plus_safety_pixel + 1);
CRGB* const ledsBuffer(leds_plus_safety_pixel + 1);

// Setting vars
#define BOOTING 0
#define WIFI 1
#define WAITING 2
#define CONNECTED 3
int status = BOOTING;
bool showOutput = false;
unsigned long previousMillis = 0;
unsigned short fps = 0;
bool newFrame = false;

// Dual core setup
TaskHandle_t Task1;


// Output martix data
void outputMatrix(void * parameter){
  while(true) {
    // Show output?
    if (showOutput) {
      // Is system waiting?
      if (status == WAITING) {
        // Pulse status LED
        FastLED.clear();
        leds[0].setRGB(0, (cos(millis() * 0.003) + 1) * 127, 0);
        FastLED.show();
      }
      else if (newFrame) {
        FastLED.show();
        fps++;
        newFrame = false;
      }
  
      // Debug
      unsigned long currentMillis = millis();
      if (currentMillis - previousMillis >= 1000) {
        // save the last time you blinked the LED
        previousMillis = currentMillis;
        Serial.print("FPS: ");
        Serial.println(fps);
        fps = 0;
      }
    }
    delay(2);
  }
}


// Web Socket events
void webSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
        Serial.printf("[%u] Disconnected!\r\n", num);

        // Only update status LED if user 1
        if (num == 0) {
          // Update status LED
          FastLED.clear();
          status = WAITING;
        }
      break;

    case WStype_TEXT:
    {
        Serial.printf("[%u] got Text: %s\n", num, payload);

        String value = ((const char*)&payload[0]);
        int pos = value.indexOf(':');
        String cmd = value.substring(0, pos);
        int val = value.substring(pos + 1).toInt();

        if (cmd == String("BRIGHTNESS")) {
          // Set matrix brightness
          int mappedBrightness = map(val, 0, 255, 0, maxBrightness);
          FastLED.setBrightness(mappedBrightness);
        }
        else {
          // Command not understood
          showOutput = false;
          FastLED.clear();
          leds[0] = CRGB::Red;
          showOutput = true;
        }

    }
      break;

    case WStype_CONNECTED:
    {
        // Client
        IPAddress ip = webSocket.remoteIP(num);

        // Is server busy?
        if (num != 0) {
          webSocket.sendTXT(num, "Busy");
          Serial.printf("[%u] Blocked client becaue busy %d.%d.%d.%d url: %s\r\n", num, ip[0], ip[1], ip[2], ip[3], payload);
          // Disconnect user
          webSocket.disconnect(num);
        }
        else {
          webSocket.sendTXT(num, "Connected");
          Serial.printf("[%u] Connected from %d.%d.%d.%d url: %s\r\n", num, ip[0], ip[1], ip[2], ip[3], payload);
       
          // Update status
          showOutput = false;
          FastLED.clear();
          leds[0] = CRGB::Blue;
          status = CONNECTED;
          showOutput = true;
        }
    }
      break;

    case WStype_BIN:
    { 
      // Add data into buffer
      for (int i = 0; i < length; i += 3) {
        ledsBuffer[i / 3].setRGB(payload[i], payload[(i + 1)], payload[(i + 2)]);
      }
  
      // Flip arrays
      showOutput = false;
      memcpy(leds, ledsBuffer, NUM_LEDS + 1);
      showOutput = true;
      newFrame = true;
    }
      break;

    default:
      Serial.printf("Invalid WStype [%d]\r\n", type);
      // Show status LED
      showOutput = false;
      FastLED.clear();
      leds[0] = CRGB::Red;
      showOutput = true;
      break;
  }
}


// Arduino setup
void setup() {
  Serial.begin(115200);
  delay(10);

  // Start Matrix
  FastLED.addLeds<CHIPSET, LED_PIN, COLOR_ORDER>(leds, NUM_LEDS).setCorrection(TypicalSMD5050);
  FastLED.setBrightness(min(BRIGHTNESS, maxBrightness));
  
  // Set status LED
  FastLED.clear();
  leds[0] = CRGB::Yellow;
  FastLED.show();
  
  // Connect to Wifi
  WiFi.begin(ssid, password);
  Serial.println("");
  while (WiFi.status() != WL_CONNECTED) {
    // Show status LED
    leds[0] = CRGB::Orange;
    FastLED.show();
    delay(200);
    Serial.print(".");
    leds[0] = CRGB::Black;
    FastLED.show();
    delay(200);
  }

  // WiFi connected
  Serial.println("");
  Serial.print("Connected to ");
  Serial.println(ssid);
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());

  // Start WebSockets
  webSocket.begin();
  webSocket.onEvent(webSocketEvent);

  // Dual core setup
  xTaskCreatePinnedToCore(
    outputMatrix,   /* Task function. */
    "outputMatrix", /* name of task. */
    1000,           /* Stack size of task */
    NULL,           /* parameter of the task */
    1,              /* priority of the task */
    &Task1,         /* Task handle to keep track of created task */
    0);             /* Core */ 

  // Start output
  status = WAITING;
  showOutput = true;
}


// Core 1 loop
void loop() {  
  // WebSocket loop
  webSocket.loop();
  delay(2);
}
