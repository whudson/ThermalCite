/*

 This code modified from example code which is in the public domain. Modifications are copyright William Hudson.
 
 */

#define BOARD_UNO 		0
#define BOARD_DIGISPARK	1

#define BOARD BOARD_UNO

#if BOARD == BOARD_UNO
	#include <SoftwareSerial.h>
#elif BOARD == BOARD_DIGISPARK
	#inculde <SoftSerial.h>
	#include <TinyPinChange.h>  /* Do not forget to include the library <TinyPinChange> that is used by the library <RcSeq> */
#endif

#include "Adafruit_Thermal.h"
#include "qrcode.h"
#include "thermalcite.h"

// BLE Module
#define PIN_RX1 2
#define PIN_TX1 3
// Printer
#define PIN_RX2 4
#define PIN_TX2 5

#if BOARD == BOARD_UNO
	// rx, tx
	SoftwareSerial portOne(PIN_RX1, PIN_TX1);
	SoftwareSerial portTwo(PIN_TX2, PIN_TX2);
#elif BOARD == BOARD_DIGISPARK
	// rx, tx
	SoftSerial portOne(PIN_RX1, PIN_TX1);
	SoftSerial portTwo(PIN_TX2, PIN_TX2);
#endif


Adafruit_Thermal printer(&portTwo);     // Pass addr to printer constructor

void setup()
{
  pinMode(PIN_RX1, INPUT);
  pinMode(PIN_RX2, OUTPUT);
  pinMode(PIN_TX1, INPUT);
  pinMode(PIN_TX2, OUTPUT);

  // Start the debugging port
  Serial.begin(19200);
  
  // Start each software serial port
  portOne.begin(9600); // BLE Serial Module
  portTwo.begin(19200); // Thermal Printer
  printer.begin();
}

void writeToPrinter( citeContainer& citationData ) {
  Serial.println("PRINTING!!!");
  printer.doubleHeightOn();
  printer.boldOn();
  printer.justify('C');
  printer.println(F("Citation"));
  printer.doubleHeightOff();
  printer.underlineOn();
  printer.println(F("Belleville, Ontario"));
  printer.underlineOff();
  printer.boldOff();
  printer.feed(1);
  printer.justify('L');
  printer.boldOn();
  printer.print(F("Date:"));
  printer.boldOff();
  printer.println(citationData.date);
  printer.boldOn();
  printer.print(F("Time:"));
  printer.boldOff();
  printer.println(citationData.time);
  printer.boldOn();
  printer.print(F("Location:"));
  printer.boldOff();
  printer.println(citationData.location);
  printer.boldOn();
  printer.print(F("License Plate:"));
  printer.boldOff();
  printer.println(citationData.plate);
  printer.boldOn();
  printer.print(F("Description:"));
  printer.boldOff();
  printer.println(citationData.description);
  printer.feed(1);
  printer.boldOn();
  printer.println(F("\x20\xcd\xcd\xcd\xcd\xcd\xcd\xcd\xcd\xcd\xcd\xcd\xcd\xcd\xcd\xcd\xcd\xcd\x20"));
  printer.println(F("REASON FOR CITATION"));
  printer.println(F("\x20\xcd\xcd\xcd\xcd\xcd\xcd\xcd\xcd\xcd\xcd\xcd\xcd\xcd\xcd\xcd\xcd\xcd\x20"));
  printer.boldOff();
  printer.println(citationData.reason);
  printer.feed(1);
  printer.doubleHeightOn();
  printer.boldOn();
  printer.println(F("FINE:"));
  printer.boldOff();
  printer.doubleHeightOff();
  printer.println(F("To learn how to drive, please\nvisit:"));
  printer.println(F("http://www.mto.gov.on.ca/english\n/dandv/driver/handbook\n/index.shtml"));
  printer.println(F("or scan the following barcode on your phone:"));
  printer.printBitmap(qrcode_width, qrcode_height, qrcode_data);
  printer.feed(3);
}

void loop()
{
  // By default, the last intialized port is listening.
  // when you want to listen on a port, explicitly select it:
  
  portOne.listen();
  // while there is data coming in, read it
  // and add it to the appropriate buffer
  while (portOne.available() > 0) {
    readBuffer = portOne.readStringUntil('\x00');
    Serial.println("GOT " + readBuffer);
    
    if (readBuffer == "MSG") { //begin
      readBuffer = portOne.readStringUntil('\x00');
      Serial.println("BEGIN " + readBuffer);
      messageField = FIELD_DATE;
    } else if (readBuffer.charAt(0) == (char)0x17 && readBuffer.endsWith("EOT")) { //end
        Serial.println("END " + readBuffer);
        messageField = FIELD_EOT;
    }
    
    switch(messageField) {
      case FIELD_DATE:
        citationData.date = readBuffer;
        break;
      case FIELD_TIME:
        citationData.time = readBuffer;
        break;
      case FIELD_LOCATION:
        citationData.location = readBuffer;
        break;
      case FIELD_PLATE:
        citationData.plate = readBuffer;
        break;
      case FIELD_DESCRIPTION:
        citationData.description = readBuffer;
        break;
      case FIELD_REASON:
        citationData.reason = readBuffer;
        break;
      case FIELD_EOT:
        writeToPrinter(citationData);
        break;
      default:
        break;
    }
    messageField++;
  }
}
  








