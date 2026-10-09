#include <iostream>
using namespace std;
int main(){
    int type = 0, num1=0,num2=0;
    cout << "What do you want to do?" << " plus " << "minus \n" << "plus type 1 " << "minus type 2 \n" << "what the number you want to calculate is?" ;
    cin >> type >> num1 >>num2;
    if (type == 1){
cout << "Ans:\n" << num1 + num2;
    }
    else if(type==2){
        cout << "Ans: \n" << num1 - num2; 
    }
    return 0;
}   