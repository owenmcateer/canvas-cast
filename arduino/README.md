This Arduino sketch will connect your device to the WiFi network, receive pixel data and output it onto your LED Matrix.  
The LEDs are controlled using the library [FastLED](https://github.com/FastLED/FastLED) this library supports all major LED chipsets.

## Troubleshooting
- __Missing library__  
Ensure you have downloaded both required Arduino libraries:  
Arduino WebSockets: https://github.com/Links2004/arduinoWebSockets
FastLED: https://github.com/FastLED/FastLED
- __No LEDs light up__  
Double check wiring.  
Double check FastLED setting. [read more](https://github.com/FastLED/FastLED/wiki/Overview)
Check status pixel, see below
Confirm web interface is connected and sending data.
- __Can't find devices IP__  
Open the console monitor in Arduino software and set baud rate to 115200. Restart/reupload the sketch and you should see the connected IP address.
- __Something else__  
If you are having any problems please log an issue.

## Status pixel
Pixel zero is used as the status pixel when no data is being cast.
 - Yellow:  Arduino booting
 - Orange:  WiFi attempting to connect
 - Green:   Ready
 - Blue:    Device connected, but no data *yet* received
 - Red:     Received bad/unexpected data
