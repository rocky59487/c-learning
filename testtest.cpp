#include <iostream>
using namespace std;

int main()
{
    int min = 0;
    int a = 0, b = 0, c = 0;
    cout << " please input three integer number ";
    cin >> a >> b >> c;
 if(a <=b)
 a <= c ? min = a : min = c;
else 
min = b <= c ? b : c;
cout << "the minimum is " << min;
    return 0;
}
