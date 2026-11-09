#pragma once
#include "reading.h"

void sensors_begin();           // I2C on GPIO6 (SDA) / GPIO7 (SCL), 100 kHz
void sensors_read(Reading &r);  // sets st/sh/at/ah and HAS_SHT40/HAS_AHT20; re-probes a failed sensor next call;
                                // a sensor turned off in secrets.h is never probed or read
