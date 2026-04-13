/***********************************************************/
//Demo for IR Relay Shield by Catalex
//Hardware: IR Relay Shield and a remote control
//Software: Arduino-1.5 built-in library: \arduino-1.5\libraries\IRremote
//Board:  Arduino UNO R3,Arduino Mega2560...
//IDE:	 Arduino-1.5
//Function: Use the remote control to control the two relays on the shield. 
//             The key "1" controls the relay 1 and the key "2" controls the relay 2.	
//Store: http://www.aliexpress.com/store/1199788
//         http://www.dx.com/
/*********************************************************************/	


#include <IRremote.h>

/*Macro definitions of the key values of the remote control */
#define KEY_POWER 0xffa25d
#define KEY_MENU  0xffe25d
#define KEY_TEST  0xff22dd
#define KEY_PLUS  0xff02fd
#define KEY_BACK  0xffc23d
#define KEY_PREV  0xffe01f
#define KEY_PLAY  0xffa857
#define KEY_NEXT  0xff906f
#define KEY_ZERO  0xff6897
#define KEY_MINUS 0xff9867
#define KEY_C     0xffb04f
#define KEY_ONE   0xff30cf
#define KEY_TWO   0xff18e7
#define KEY_THREE 0xff7a85
#define KEY_FOUR  0xff10ef
#define KEY_FIVE  0xff38c7
#define KEY_SIX   0xff5aa5
#define KEY_SEVEN 0xff42bd
#define KEY_EIGHT 0xff4ab5
#define KEY_NINE  0xff52ad
/******Macro definitions of pins used*********/
#define RECV_PIN 2
#define RELAY1_PIN 8
#define RELAY2_PIN 7

boolean relay1_state = 0;
boolean relay2_state = 0;

IRrecv irrecv(RECV_PIN);

decode_results results;

void setup()
{
  Serial.begin(9600);
  initIRrelayshield();
}

void loop() {
  if (irrecv.decode(&results)) {
    Serial.println(results.value, HEX);
    irrecv.resume(); // Receive the next value
    if(results.value == KEY_ONE)relay1_state = !relay1_state;
    else if(results.value == KEY_TWO)relay2_state = !relay2_state; 
    if(relay1_state != 0)relay1_state = HIGH;
    if(relay2_state != 0)relay2_state = HIGH;
    digitalWrite(RELAY1_PIN, relay1_state);//if the state is HIGH, COM1 connected to NO1
	                                       //if the state is LOW, COM1 connected to NC1
    digitalWrite(RELAY2_PIN, relay2_state);//if the state is HIGH, COM2 connected to NO2
	                                       //if the state is LOW, COM2 connected to NC2
  }
}

void initIRrelayshield()
{
  pinMode(RELAY1_PIN, OUTPUT);
  digitalWrite(RELAY1_PIN, LOW);
  pinMode(RELAY2_PIN, OUTPUT);
  digitalWrite(RELAY2_PIN, LOW);
  irrecv.enableIRIn(); // Start the receiver
}

