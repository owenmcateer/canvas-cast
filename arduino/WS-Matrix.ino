// Config

// Wifi SSID and password
const char* ssid = "";
const char* password = "";

// Matrix size
const uint8_t kMatrixWidth = 16;
const uint8_t kMatrixHeight = 8;

// This can be used as a safety feature (0-255)
const int maxBrightness = 255;

// Matrix settings
// See FastLED for more info: https://github.com/FastLED/FastLED/wiki/Overview
#define LED_PIN 3
#define COLOR_ORDER GRB
#define CHIPSET WS2812B
#define BRIGHTNESS 127
// End config

// Wifi and WebSockets
#include <ESP8266WiFi.h>
#include <WiFiClient.h>
#include <WebSocketsServer.h>
#include <Hash.h>
WebSocketsServer webSocket = WebSocketsServer(81);

// Matrix
#include <FastLED.h>
#define NUM_LEDS (kMatrixWidth * kMatrixHeight)
CRGB leds_plus_safety_pixel[NUM_LEDS + 1];
CRGB* const leds(leds_plus_safety_pixel + 1);

// Misc
#define BOOTING 0
#define WIFI 1
#define WAITING 2
#define CONNECTED 3
int status = BOOTING;

void setup() {
  Serial.begin(115200);

  // Start Matrix
  FastLED.addLeds<CHIPSET, LED_PIN, COLOR_ORDER>(leds, NUM_LEDS).setCorrection(TypicalSMD5050);
  FastLED.setBrightness(min(BRIGHTNESS, maxBrightness));
  // Set status LED
  leds[0] = CRGB::Yellow;
  FastLED.show();

  // Connect to Wifi
  WiFi.begin(ssid, password);
  Serial.println("");
  while (WiFi.status() != WL_CONNECTED) {
    // Show status LED
    leds[0] = CRGB::Orange;
    FastLED.show();
    delay(250);
    Serial.print(".");
    leds[0] = CRGB::Black;
    FastLED.show();
    delay(250);
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

  // Ready and waiting
  status = WAITING;
}


void loop() {
  // Is system waiting?
  if (status == WAITING) {
    // Pulse status LED
    leds[0].setRGB(0, (cos(millis() * 0.003) + 1) * 127, 0);
    FastLED.show();
  }

  // WebSocket loop
  webSocket.loop();
}


void webSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
        Serial.printf("[%u] Disconnected!\r\n", num);
        // Update status LED
        FastLED.clear();
        status = WAITING;
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
          leds[0] = CRGB::Red;
          FastLED.show();
        }

    }
      break;

    case WStype_CONNECTED:
    {
        IPAddress ip = webSocket.remoteIP(num);
        Serial.printf("[%u] Connected from %d.%d.%d.%d url: %s\r\n", num, ip[0], ip[1], ip[2], ip[3], payload);
        // Update status
        leds[0] = CRGB::Blue;
        FastLED.show();
        status = CONNECTED;
    }
      break;

    case WStype_BIN:
      // Serial.printf("[%u] get binary length: %u\n", num, length);
      for (int i = 0; i < length; i += 3) {
        leds[i / 3].setRGB(payload[i], payload[(i + 1)], payload[(i + 2)]);
      }
      FastLED.show();
      break;

    default:
      Serial.printf("Invalid WStype [%d]\r\n", type);
      // Show status LED
      leds[0] = CRGB::Red;
      FastLED.show();
      break;
  }
}
