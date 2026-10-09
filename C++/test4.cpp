#include <iostream>
using namespace std;
int main()
{
    int num1 = 0, num2 = 0;
cout << "please enter two number, " << "separated by a white space: ";
cin >> num1 >> num2 ;
if(num1 > num2)
cout << "The larger number is " << num1;
if(num2 > num1)
cout << "The larger number is " << num2;
if(num2 == num1)
cout << "The numbers are equal";
    return 0;
}
