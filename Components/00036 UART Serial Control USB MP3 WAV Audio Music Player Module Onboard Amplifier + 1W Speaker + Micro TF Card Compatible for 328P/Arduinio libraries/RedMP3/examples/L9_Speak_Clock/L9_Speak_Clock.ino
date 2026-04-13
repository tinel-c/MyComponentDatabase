/************************************************* ************************************************** ******
* OPEN-SMART Red Serial MP3 Player Lesson 9: Speak clock
NOTE!!! First of all you should download the voice resources from our google drive:
https://drive.google.com/drive/folders/1Y8CYgHcJfa3CxeA_H6ugRz-e4OMmWQ_G?usp=sharing

Then unzip it and find the 01 and 02 folder and put them into your TF card (should not larger than 32GB). 

* You can learn how to speak the time you get from the RTC module
   according to the value and the filename of digit /beep tone.
*
* The following functions are available:

* touch.get(); / / return is the touch area corresponding Arduino pin number, if not then return -1

* timer1.initialize(unsigned long microseconds); // set the timed length, the unit is subtle
* timer1.attachInterrupt (TimingISR); // set interrupt routine function name, is the timing interrupt entry
* disp.init(); // initialization
* disp.display(int Decimal);   // display range: -999 ~ 9999

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
Compatible 4-digit display:
https://www.aliexpress.com/item/1774211527.html
Compatible RTC:
https://www.aliexpress.com/item/32232621848.html
************************************************** **************************************************/
#include <Wire.h>
#include <SoftwareSerial.h>
#include <TimerOne.h>

#include "RedMP3.h"
#include <OS_AnalogButton.h>
#include "TM1637.h"
#include "DS1307.h"

DS1307 clock;//define a object of DS1307 class  buy from dx.com/316101

#define CLK 12//CLK of the TM1637 IC connect to D12 of Arduino
#define DIO 13//DIO of the TM1637 IC connect to D13 of Arduino
TM1637 disp(CLK,DIO); //

#define ON 1
#define OFF 0

int8_t Time[] = {0,0,0,0};
unsigned char ClockPoint = 1;
unsigned char Update;

#define BUTTON_PIN A0
AnalogButton button(BUTTON_PIN);
#define K1 1
#define K2 2
#define K3 3


#define MP3_RX 4//RX of Serial MP3 module connect to D4 of Arduino
#define MP3_TX 2//TX to D2, note that D2 can not be used as RX on Mega2560, you should modify this if you donot use Arduino UNO
MP3 mp3(MP3_RX, MP3_TX);

int8_t volume = 0x1a;//0~0x1e (30 adjustable level)
int8_t folderName = 2;//folder name must be 01 02 03 04 ...
int8_t fileName = 1; // prefix of file name must be 001xxx 002xxx 003xxx 004xxx ...099xxx
#define NUM_OFFSET 2//lonly for 0~19, offset between number and file name, such as file name of 0 is 002, 1 is 003
#define TEN_OFFSET 20//only for whole ten, offset between whole ten digit and file name, such as file name of 20 is 22, 30 is 23, 40 is 24

void setup()
{
  delay(500);//Requires 500ms to wait for the MP3 module to initialize  
  disp.init();//The initialization of the display
  disp.set(BRIGHT_TYPICAL);
  clock.begin();
  Timer1.initialize(500000);//timing for 500ms
  Timer1.attachInterrupt(TimingISR);//declare the interrupt serve routine:TimingISR 
  mp3.setVolume(volume);
}

void loop()
{
  
  int key;
  uint8_t flag_speak = 0;//0 = not speak, 1 = to speak
  key = button.getNum();
  if(key == K2) //if you press K2
  {
    delay(10);//delay for 10ms
    if(button.getNum() == K2)//check it again
    {
      flag_speak = 1;
    }
	while(button.getNum() == K2);//Wait for the button to be released
  }
  if(Update == ON)//Update the display time, is to flash the clock porint
  {
    TimeUpdate();
    disp.display(Time);
  }
  if(flag_speak)
  {
    SpeakTime(Time);
	flag_speak = 0;
  }
}

void SpeakTime(int8_t time[])
{
  uint8_t addr[10] = {0};
  uint8_t next = 0;
  addr[next++] = 31;//031 before speak time
  addr[next++] = 32;//032 opensmart time
  if(Time[0] < 2)
  {
    addr[next++] = Time[0]*10 + Time[1]+NUM_OFFSET;
  }
  else
  {
    addr[next++] = 22;//022 twenty
    if(Time[1] != 0) addr[next++] = Time[1] + NUM_OFFSET;
  }
  if((Time[2] == 0) && (Time[3] == 0)) addr[next++] = 33;//033 e clock
  else{
    if(Time[2] < 2){
  	  addr[next++] = Time[2]*10 + Time[3]+NUM_OFFSET;
  	}
	else
	{
	  addr[next++] = Time[2] + TEN_OFFSET;
	  if(Time[3] != 0)addr[next++] = Time[3] + NUM_OFFSET;
	}
  }
  SpeakGroup(addr, next);
}


void SpeakGroup(uint8_t addr[], uint8_t size)//
{
  
  for(uint8_t i=0; i < size; i ++)
  {
    while(mp3.getStatus()!=STATUS_STOP)delay(50);
	mp3.playWithFileName(folderName,addr[i]);
  }
  while(mp3.getStatus()!=STATUS_STOP)delay(50);
}

/**********Timer 1 interrupt routine*********/
void TimingISR()
{
  Update = ON;
  ClockPoint = !ClockPoint;
}

void TimeUpdate(void)
{
  if(ClockPoint)disp.point(POINT_ON);
  else disp.point(POINT_OFF);
  clock.getTime();
  Time[0] = clock.hour / 10;
  Time[1] = clock.hour % 10;
  Time[2] = clock.minute / 10;
  Time[3] = clock.minute % 10;
  Update = OFF;
}

/*********************************************************************************************************
The end of file
*********************************************************************************************************/

