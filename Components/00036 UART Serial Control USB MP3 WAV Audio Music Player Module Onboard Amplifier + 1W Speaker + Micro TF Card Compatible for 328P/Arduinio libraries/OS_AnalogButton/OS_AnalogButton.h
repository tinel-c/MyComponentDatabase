#ifndef _OPENSMART_ANALOGBUTTON_H__
#define _OPENSMART_ANALOGBUTTON_H__

#include <Arduino.h>

#define BUTTON_TOLERANCE 30
class AnalogButton{

private:

    int _pin;

public:

    AnalogButton(int pin)
    {
        _pin = pin;
        pinMode(_pin, INPUT);
    }
    
    uint8_t getNum()                        
    {
      uint16_t value;
	  value = analogRead(_pin);
	  if(value < 0+BUTTON_TOLERANCE)
		return 0;
	  else if( (value > 200-BUTTON_TOLERANCE)&&(value < 200+BUTTON_TOLERANCE))
		return 1;
	  else if ((value > 400-BUTTON_TOLERANCE)&&(value < 400+BUTTON_TOLERANCE))
		return 2;
	  else if ((value > 600-BUTTON_TOLERANCE)&&(value < 600+BUTTON_TOLERANCE))
		return 3;
	  else return 0;
    }
};

#endif
/*********************************************************************************************************
  END FILE
*********************************************************************************************************/