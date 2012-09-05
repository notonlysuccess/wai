#include <cstdio>
#include <cstring>
#include <cstdlib>
#include <unistd.h>
#include <string>
using namespace std;

const int BUF_LEN = 128;
const int N = 8;
const int dir[][2] = {{-1,-1},{-1,0},{-1,1},{0,-1},{0,1},
    {1,-1},{1,0},{1,1}};

int board[N][N];

inline bool in(int x, int y) {
    return x >= 0 && x < N && y >= 0 && y < N;
}

bool valid(int x, int y, int cur) {
    if (!in(x,y)) return false;
    if (board[x][y] != 0) return false;
    int tx, ty;
    for (int d = 0 ;  d < 8 ; d++) {
        tx = x + dir[d][0];
        ty = y + dir[d][1];
        if (in(tx,ty) && board[tx][ty] == 3 - cur) {
            while (true) {
                tx += dir[d][0];
                ty += dir[d][1];
                if (!in(tx,ty)) break;
                if (board[tx][ty] == cur)
                    return true;
                else if (board[tx][ty] == 0)
                    break;
            }
        } 
    }
    return false;
}

void put_chess(int x, int y, int cur) {
    board[x][y] = cur;
    int tx, ty;
    for (int d = 0 ; d < 8 ; ++d) {
        tx = x + dir[d][0];
        ty = y + dir[d][1];
        while (in(tx,ty) && board[tx][ty] == 3 - cur) {
            tx += dir[d][0];
            ty += dir[d][1];
        }
        if (in(tx,ty) && board[tx][ty] == cur) {
            tx -= dir[d][0];
            ty -= dir[d][1];
            while (tx != x || ty != y) {
                board[tx][ty] = cur;
                tx -= dir[d][0];
                ty -= dir[d][1];
            }
        }
    }
}

bool can_move(int cur) {
    for (int i = 0 ; i < N ; i++)
        for (int j = 0 ; j < N ; j++) {
            if (board[i][j] != 0) continue;
            if (valid(i, j, cur)) return true;
        }
    return false;
}

int get_winner(int *cnt_black, int *cnt_white) {
    int c1 = 0, c2 = 0;
    for (int i = 0 ; i < N ; i++)
        for (int j = 0 ; j < N ; j++)
            if (board[i][j] == 1) ++c1;
            else if (board[i][j] == 2) ++c2;
    *cnt_black = c1;
    *cnt_white = c2;
    if (c1 > c2) return 1;
    if (c2 > c1) return 2;
    return 0;
}

void output_board() {
    for (int i = 0 ; i < N ; i++) {
        for (int j = 0 ; j < N ; j++)
            if (board[i][j] == 0) fprintf(stderr, "-");
            else if (board[i][j] == 1) fprintf(stderr, "O");
            else fprintf(stderr, "X");
        fprintf(stderr, "\n");
    }
}

inline string get_result_str(int side) {
  if (side == 0) return "Draw";
  if (side == 1) return "Player_1_win";
  return "Player_2_win";
}

bool allow[3] = {false, false, false};

int main(int argc, char **argv) {
    for (int i = 1 ; i < argc ; ++i) {
        int tmp;
        sscanf(argv[i], "%d", &tmp);
        allow[tmp] = true;
    }
    memset(board, 0, sizeof(board));
    board[3][3] = board[4][4] = 1;
    board[3][4] = board[4][3] = 2;
    printf(">1: first\n");
    fflush(stdout);
    printf(">2: second\n");
    fflush(stdout);
    int cur = 1;
    char tmp_buf[BUF_LEN+10];
    while (1) {
        int x, y;
        if (!can_move(cur)) {
            if (can_move(3-cur)) {
              printf("<%d\n", cur);
              fflush(stdout);
              fgets(tmp_buf, BUF_LEN, stdin);
              sscanf(tmp_buf, "%d %d", &x, &y);
              // ignore (x,y), skip
              printf("+%d -1 -1\n", cur);
              fflush(stdout);
              printf(">%d: -1 -1\n", 3-cur);
              fflush(stdout);
              cur = 3 - cur;
            }
            else break;
        }
start:
        printf("<%d\n", cur);
        fflush(stdout);
        fgets(tmp_buf, BUF_LEN, stdin);
        sscanf(tmp_buf, "%d %d",&x,&y);
        if (!valid(x, y, cur)) {
            if (allow[cur]) {
                printf("*\n");
                fflush(stdout);
                goto start;
            }
            if (cur == 1) 
              printf("%d %s Black_make_invalid_move.\n", 3-cur,
                get_result_str(3-cur).c_str());
            else
              printf("%d %s White_make_invalid_move.\n", 3-cur,
                get_result_str(3-cur).c_str());
            fflush(stdout);
            return 0;
        }
        printf("+%d %d %d\n", cur, x, y);
        fflush(stdout);
        put_chess(x, y, cur);
        output_board();
        printf(">%d: %d %d\n", 3-cur, x, y);
        fflush(stdout);
        cur = 3 - cur;
    }
    int cnt_black, cnt_white;
    int w = get_winner(&cnt_black, &cnt_white);
    printf("%d %s BlackCnt[%d]:WhiteCnt[%d]\n", w,
      get_result_str(w).c_str(), cnt_black, cnt_white);
    fflush(stdout);
    return 0;
}

