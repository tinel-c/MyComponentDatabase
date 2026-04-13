/************************************************* ************************************************** ******
* OPEN-SMART Red Serial MP3 Player Lesson 7: IR control MP3
NOTE!!! First of all you should download the voice resources from our google drive:
https://drive.google.com/drive/folders/1Y8CYgHcJfa3CxeA_H6ugRz-e4OMmWQ_G?usp=sharing

Then unzip it and find the 01 and 02 folder and put them into your TF card (should not larger than 32GB). 

* You can learn how to use the Infrared remote control to control the MP3, and when you press the button, the buzzer beep.
*
* The following functions are available:

* buzzer.on();//turn on the buzzer
* buzzer.off();//turn off the buzzer

* IR.enableIRIn(); // Start the receiver
* IR.decode();//if no result, it return 0, otherwise it return 1; .
* IR.resume(); // so that it can receive the next value
* IR.isReleased();//if the button is not released yet, it return 0; otherwise it return 1;

/--------basic operations---------------/
mp3.play();
mp3.pause();
mp3.nextSong();
mp3.previousSong();
mp3.volumeUp();
mp3.volumeDown();
/--------------------------------/
mp3.playWithIndex(int8_t index);//play the song according to the physical index of song in the TF card
mp3.setVolume(int8_t vol);//vol is 0~0x1e, 30 adjustable level
mp3.playWithFileName(int8_t directory, int8_t file);//play a song according to the folder name and prefix of its file name
                                                            //foler name must be 01 02 03...09 10...99
                                                            //prefix of file name must be 001...009 010...255

About SoftwareSerial library:
The library has the following known limitations:
If using multiple software serial ports, only one can receive data at a time.

Not all pins on the Mega and Mega 2560 support change interrupts, so only the following can be used for RX: 
10, 11, 12, 13, 14, 15, 50, 51, 52, 53, A8 (62), A9 (63), A10 (64), A11 (65), A12 (66), A13 (67), A14 (68), A15 (69).

Not all pins on the Leonardo and Micro support change interrupts, so only the following can be used for RX: 
8, 9, 10, 11, 14 (MISO), 15 (SCK), 16 (MOSI).
On Arduino or Genuino 101 the current maximum RX speed is 57600bps.
On Arduino or Genuino 101 RX doesn't work on Pin 13.

Product link: 
USB MP3 + TF card + Speaker:
https://www.aliexpress.com/item/1005003274011049.html
Easy IO Shield:
https://www.aliexpress.com/item/4000022518637.html
OPEN-SMART ONE R3 C board:
https://www.aliexpress.com/item/1005002536184038.html
XH2.54MM cable pack:
https://www.aliexpress.com/item/1005002286548127.html
Compatible Buzzer:
https://www.aliexpress.com/item/1832679609.html
Compatible IR remote + IR receiver:
https://www.aliexpress.com/item/32800812853.html
************************************************** **************************************************/
#include <SoftwareSerial.h>

#include "RedMP3.h"
#include "IRremote.h"
#include "OS_Buzzer.h"

#define BUZZER_PIN 5     //the SIG pin of the Buzzer module is connected with D5 of Arduino / OPEN-SMART UNO
Buzzer buzzer(BUZZER_PIN);

#define MP3_RX 4//RX of Serial MP3 module connect to D4 of Arduino
#define MP3_TX 2//TX to D2, note that D2 can not be used as RX on Mega2560, you should modify this if you donot use Arduino UNO
MP3 mp3(MP3_RX, MP3_TX);

#define RECV_PIN 3//the SIG pin of Infrared Receiver is connected with D3 of Arduino / OPEN-SMART UNO
IRrecv IR(RECV_PIN);

void setup()
{
  delay(500);//Requires 500ms to wait for the MP3 module to initialize
  IR.enableIRIn();
  Serial.begin(9600);
}

void loop()
{
  if (IR.decode()) {//If decode is valid

    if(IR.isReleased())//If it is not the repeat code for long press
	{
	  buzzer.on();//every time you press the key, the buzzer will beep
	  switch(IR.keycode)
	  {
	    case KEY_PLUS:  mp3.volumeUp();break;
		case KEY_MINUS: mp3.volumeDown();break;
		case KEY_PLAY:  if(mp3.getStatus()==STATUS_PAUSE)mp3.play();
				        else if(mp3.getStatus()==STATUS_PLAY) mp3.pause();
						break;
		case KEY_PREV: mp3.previousSong();break;
		case KEY_NEXT:  mp3.nextSong();break;
		case KEY_ONE:  mp3.playWithIndex(0x01);break;
		case KEY_TWO:   mp3.playWithIndex(0x02);break;
		default: break;
	  }	 
	  delay(100);   //buzzer beep for 100ms
	  buzzer.off(); //turn off the buzzer
    }
    IR.resume(); // Receive the next value
  }
  
}

/*********************************************************************************************************
The end of file
*********************************************************************************************************/
