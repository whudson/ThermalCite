# ThermalCite #
Cordova app and companion arduino sketch for thermally printing "citations"

This application consists of two seperate components:

1. A cordova application which uses the evothings/cordova-ble plugin to establish a serial link over BLE and accept input from users.
2. An arduino sketch which recieves data from a SoftwareSerial port at 9600 baud, buffers this data, and inserts it into a hardcoded print template.

## Cordova Application ##

Requires https://github.com/evothings/cordova-ble
Tested on Cyanogenmod 12.1 Galaxy S5, Android 5 Galaxy S5.

## Arduino Sketch ##

Targeted to Uno, and Digispark boards.
Requires Adafruit Thermal Printer Library (tested on v1.1.0).
Requires Digispark libraries for Digispark boards.

Incoming serial data on pin 2 (9600 baud).
Outgoing serial data to printer on pin 5 (19200 baud).
Built in serial port is used for debug. (19200 baud).
