#include <OS_AnalogButton.h>
#define BUTTON_PIN A0
AnalogButton button(BUTTON_PIN);

uint8_t oldnum,newnum=0;
void setup() {
  Serial.begin(9600);
  
}

void loop() {
  uint8_t button_num;
  newnum = button.getNum();
  if(newnum != oldnum)
  {
	delay(10);
    oldnum = newnum;
    if(newnum!=0)
	{
		Serial.print("Button number #");
		Serial.println(newnum);
	}
	else Serial.println("Button Release");
  }
}

