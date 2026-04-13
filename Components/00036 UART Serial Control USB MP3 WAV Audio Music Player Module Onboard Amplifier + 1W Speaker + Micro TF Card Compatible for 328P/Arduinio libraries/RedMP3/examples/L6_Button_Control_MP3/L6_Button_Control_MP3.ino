/************************************************* ************************************************** ******
* OPEN-SMART Red Serial MP3 Player Lesson 6: Touch control MP3
NOTE!!! First of all you should download the voice resources from our google drive:
https://drive.google.com/drive/folders/1Y8CYgHcJfa3CxeA_H6ugRz-e4OMmWQ_G?usp=sharing

Then unzip it and find the 01 and 02 folder and put them into your TF card (should not larger than 32GB). 

* You can learn how to use the 3-channel Analog Button sensor to control the MP3, 
* such as play / pause / next song / previous song operations.
*
* The following functions are available:

* touch.get(); // return is the touch area corresponding Arduino pin number, if not then return -1
* touch.getLongPress(); // return long press the corresponding Arduino pin number, if not return -1

/--------basic operations---------------/
mp3.play();
mp3.pause();
mp3.nextSong();
mp3.previousSong();
mp3.volumeUp();
mp3.volumeDown();
mp3.forward();    //fast forward
mp3.rewind();     //fast rewind
mp3.stopPlay();  
mp3.stopInject(); //when you inject a song, this operation can stop it and come back to the song befor you inject
mp3.singleCycle();//it can be set to cycle play the currently playing song 
mp3.allCycle();   //to cycle play all the songs in the TF card
/--------------------------------/

mp3.playWithIndex(int8_t index);//play the song according to the physical index of song in the TF card

mp3.injectWithIndex(int8_t index);//inject a song according to the physical index of song in the TF card when it is playing song.

mp3.setVolume(int8_t vol);//vol is 0~0x1e, 30 adjustable level

mp3.playWithFileName(int8_t directory, int8_t file);//play a song according to the folder name and prefix of its file name
                                                            //foler name must be 01 02 03...09 10...99
                                                            //prefix of file name must be 001...009 010...099

mp3.playWithVolume(int8_t index, int8_t volume);//play the song according to the physical index of song in the TF card and the volume set

mp3.cyclePlay(int16_t index);//single cycle play a song according to the physical index of song in the TF

mp3.playCombine(int16_t folderAndIndex[], int8_t number);//play combination of the songs with its folder name and physical index
      //folderAndIndex: high 8bit is folder name(01 02 ...09 10 11...99) , low 8bit is index of the song
      //number is how many songs you want to play combination

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
Compatible Analog button:
https://www.aliexpress.com/item/1005003404607069.html

************************************************** **************************************************/
#include <SoftwareSerial.h>

#include <OS_AnalogButton.h>
#include "RedMP3.h"

#define MP3_RX 4//RX of Serial MP3 module connect to D4 of Arduino
#define MP3_TX 2//TX to D2, note that D2 can not be used as RX on Mega2560, you should modify this if you donot use Arduino UNO
MP3 mp3(MP3_RX, MP3_TX);

#define BUTTON_PIN A0
AnalogButton button(BUTTON_PIN);
#define K1 1
#define K2 2
#define K3 3

int8_t volume = 0x1a;//0~0x1e (30 adjustable level)
int8_t folderName = 0x01;//folder name must be 01 02 03 04 ...
int8_t fileName = 0x01; // prefix of file name must be 001xxx 002xxx 003xxx 004xxx ...

void setup()
{
  delay(500);//Requires 500ms to wait for the MP3 module to initialize  
  mp3.setVolume(volume);
  delay(50);//you should wait for >=50ms between two commands
  mp3.playWithFileName(folderName,fileName);
  delay(50);
}

void loop()
{
  int key;
  key = button.getNum();
  if(key != 0)// there is a button pressed
  {
    delay(10);
	if(key == button.getNum())// Check again if there is a button pressed
	{
	  switch(key)
	  {
		case K1: mp3.previousSong(); break;//touch TCH4 area
	    case K2: if(mp3.getStatus()==STATUS_PAUSE)mp3.play();
				 else if(mp3.getStatus()==STATUS_PLAY) mp3.pause(); break;//if press K1 
		case K3: mp3.nextSong(); break;//if press K2
		default: break;
	  }
	}
	while(key == button.getNum());//Wait for the button to be released
  }
  delay(50);//
}

/*********************************************************************************************************
The end of file
*********************************************************************************************************/
