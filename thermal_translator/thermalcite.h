typedef struct {
	String date;
	String time;
	String location;
	String plate;
	String description;
	String reason;
} citeContainer;

String readBuffer;
citeContainer citationData;

#define FIELD_DATE 1
#define FIELD_TIME 2
#define FIELD_LOCATION 3
#define FIELD_PLATE 4
#define FIELD_DESCRIPTION 5
#define FIELD_REASON 6
#define FIELD_EOT 0
char messageField;

void writeToPrinter( citeContainer& citationData );